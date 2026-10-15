import { ESLint } from "eslint";
import config from "./config.js";

export async function formatFiles(patterns, { check = false, cwd = process.cwd() } = {}) {
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: config,
    fix: true,
  });
  const results = await eslint.lintFiles(patterns);

  // Validate the whole batch before writing any fixes.
  const failed = results.some((result) => result.messages.length > 0);
  if (!check && !failed) {
    await ESLint.outputFixes(results);
  }

  return { results, failed };
}
