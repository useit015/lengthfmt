#!/usr/bin/env node
import { relative } from "node:path";
import { parseArgs } from "node:util";
import pkg from "../package.json" with { type: "json" };
import { formatFiles } from "../src/format.js";

const help = `Usage: lengthfmt [--check] <files, directories, or globs...>

Sort imports, object properties, and React dependency arrays shortest first.
Files are updated in place. No ESLint configuration is needed.

Options:
  -c, --check    Check without writing files (exit 1 if changes are needed)
  -h, --help     Show this help
  -v, --version  Show the version

Examples:
  lengthfmt src
  lengthfmt "src/**/*.{ts,tsx}"
  lengthfmt --check src
`;

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      check: { type: "boolean", short: "c" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });

  if (values.help) {
    process.stdout.write(help);
  } else if (values.version) {
    console.log(pkg.version);
  } else if (positionals.length === 0) {
    process.stderr.write(help);
    process.exitCode = 2;
  } else {
    const { results, failed } = await formatFiles(positionals, { check: values.check });
    const changed = results.filter((result) => result.output !== undefined);

    if (failed) {
      for (const result of results) {
        for (const message of result.messages) {
          console.error(
            `${relative(process.cwd(), result.filePath)}:${message.line ?? 1}:${message.column ?? 1} ${message.message}`,
          );
        }
      }
      console.error("No files written.");
      process.exitCode = 2;
    } else {
      for (const result of changed) {
        console.log(`${values.check ? "Would format" : "Formatted"} ${relative(process.cwd(), result.filePath)}`);
      }
      console.log(`Checked ${results.length} file(s); ${changed.length} ${values.check ? "need formatting" : "formatted"}.`);
      process.exitCode = values.check && changed.length > 0 ? 1 : 0;
    }
  }
} catch (error) {
  console.error(`lengthfmt: ${error.message}`);
  process.exitCode = 2;
}
