import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { formatFiles } from "../src/format.js";

const cli = fileURLToPath(new URL("../bin/lengthfmt.js", import.meta.url));

async function fixture(t, files) {
  const cwd = await mkdtemp(join(tmpdir(), "lengthfmt-test-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    const path = join(cwd, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
  return cwd;
}

function run(cwd, ...args) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8" });
  assert.ifError(result.error);
  return result;
}

test("sorts imports, named imports, and object properties, preserving length ties", async (t) => {
  const cwd = await fixture(t, {
    "editor.ts": `import { Sidebar, Nav } from "@/components/sidebar";
import React from "react";
import { Footer } from "@/components/footer";
const editor = buildEditor({
  strokeDashArray,
  undo,
  redo,
  canvas,
  copy,
});
`,
  });

  const { failed } = await formatFiles(["editor.ts"], { cwd });
  assert.equal(failed, false);
  assert.equal(await readFile(join(cwd, "editor.ts"), "utf8"), `import React from "react";
import { Footer } from "@/components/footer";
import { Nav, Sidebar } from "@/components/sidebar";
const editor = buildEditor({
  undo,
  redo,
  copy,
  canvas,
  strokeDashArray,
});
`);
  const second = await formatFiles(["editor.ts"], { cwd, check: true });
  assert.equal(second.failed, false);
  assert.equal(second.results[0].output, undefined);
});

test("targets React hook dependencies, including namespace calls and imperative handles", async (t) => {
  const calls = [];
  for (const prefix of ["", "React."]) {
    for (const hook of ["useMemo", "useCallback", "useEffect", "useLayoutEffect", "useInsertionEffect"]) {
      calls.push(`${prefix}${hook}(fn, [strokeDashArray, undo, canvas]);`);
    }
    calls.push(`${prefix}useImperativeHandle(ref, fn, [strokeDashArray, undo, canvas]);`);
  }
  const controls = `const ordinary = [strokeDashArray, undo, canvas];
somethingElse(fn, [strokeDashArray, undo, canvas]);
useMemo([strokeDashArray, undo, canvas], other);
useImperativeHandle(ref, [strokeDashArray, undo, canvas], other);
other.useMemo(fn, [strokeDashArray, undo, canvas]);
`;
  const cwd = await fixture(t, { "hooks.tsx": `${calls.join("\n")}\n${controls}` });
  const { failed } = await formatFiles(["hooks.tsx"], { cwd });
  assert.equal(failed, false);
  const output = await readFile(join(cwd, "hooks.tsx"), "utf8");
  for (const call of calls) {
    assert.ok(output.includes(call.replace("[strokeDashArray, undo, canvas]", "[undo, canvas, strokeDashArray]")));
  }
  assert.ok(output.endsWith(controls));
});

test("keeps spread boundaries and comments attached to their properties", async (t) => {
  const cwd = await fixture(t, {
    "spread.js": `const options = {
  strokeDashArray,
  // Undo the last action.
  undo,
  ...defaults,
  fontWeight,
  redo,
};
`,
  });
  const { failed } = await formatFiles(["spread.js"], { cwd });
  assert.equal(failed, false);
  assert.equal(await readFile(join(cwd, "spread.js"), "utf8"), `const options = {
  // Undo the last action.
  undo,
  strokeDashArray,
  ...defaults,
  redo,
  fontWeight,
};
`);
});

test("retains the order of side-effect imports", async (t) => {
  const cwd = await fixture(t, {
    "imports.js": `import "./z.css";
import "./a.css";
import { VeryLongName } from "long-module";
import X from "x";
`,
  });
  const { failed } = await formatFiles(["imports.js"], { cwd });
  assert.equal(failed, false);
  const output = await readFile(join(cwd, "imports.js"), "utf8");
  assert.ok(output.startsWith('import "./z.css";\nimport "./a.css";\n'));
  assert.ok(output.indexOf('import X from "x"') < output.indexOf("import { VeryLongName }"));
});

test("finds all supported file extensions and parses JSX and TypeScript", async (t) => {
  const files = {};
  for (const extension of ["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts"]) {
    files[`src/editor.${extension}`] = "const editor = { strokeDashArray, undo };\n";
  }
  files["src/component.jsx"] = "const view = <div style={{ strokeDashArray, undo }} />;\n";
  files["src/component.tsx"] = "const view: JSX.Element = <div style={{ strokeDashArray, undo }} />;\n";
  files["src/README.md"] = "# Leave documentation alone\n";
  files["eslint.config.js"] = "throw new Error('Project configuration must not load');";
  const cwd = await fixture(t, files);
  const { results, failed } = await formatFiles(["src"], { cwd });
  assert.equal(failed, false);
  assert.equal(results.length, 10);
  for (const result of results) {
    assert.ok((await readFile(result.filePath, "utf8")).includes("{ undo, strokeDashArray }"));
  }
});

test("CLI check and write modes report the right exit codes and preserve bytes in check mode", async (t) => {
  const source = "const editor = { strokeDashArray, undo };\n";
  const cwd = await fixture(t, { "src/editor.ts": source });
  const checked = run(cwd, "--check", "src");
  assert.equal(checked.status, 1, checked.stderr);
  assert.match(checked.stdout, /Would format src\/editor.ts/);
  assert.equal(await readFile(join(cwd, "src/editor.ts"), "utf8"), source);
  const written = run(cwd, "src");
  assert.equal(written.status, 0, written.stderr);
  assert.match(written.stdout, /Formatted src\/editor.ts/);
  assert.equal(await readFile(join(cwd, "src/editor.ts"), "utf8"), "const editor = { undo, strokeDashArray };\n");
  const clean = run(cwd, "--check", "src/**/*.{ts,tsx}");
  assert.equal(clean.status, 0, clean.stderr);
  assert.match(clean.stdout, /0 need formatting/);
});

test("a parse error prevents the whole batch from being written", async (t) => {
  const source = "const editor = { strokeDashArray, undo };\n";
  const invalid = "const broken = {;\n";
  const cwd = await fixture(t, { "valid.js": source, "invalid.js": invalid });
  const result = run(cwd, ".");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /invalid.js:\d+:\d+ Parsing error/);
  assert.match(result.stderr, /No files written/);
  assert.equal(await readFile(join(cwd, "valid.js"), "utf8"), source);
  assert.equal(await readFile(join(cwd, "invalid.js"), "utf8"), invalid);
});

test("CLI handles help, version, missing paths, unsupported files, and invalid flags", async (t) => {
  const cwd = await fixture(t, { "notes.txt": "Some text.\n" });
  assert.equal(run(cwd, "--help").status, 0);
  assert.equal(run(cwd, "--version").stdout.trim(), "0.1.0");
  for (const args of [[], ["missing.ts"], ["notes.txt"], ["--unknown"]]) {
    const result = run(cwd, ...args);
    assert.equal(result.status, 2, `${args}: ${result.stdout} ${result.stderr}`);
    assert.ok(result.stderr.length > 0);
  }
});
