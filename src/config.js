import parser from "@typescript-eslint/parser";
import perfectionist from "eslint-plugin-perfectionist";

const byLength = { type: "line-length", order: "asc" };
const hooks = "/^use(Memo|Callback|Effect|LayoutEffect|InsertionEffect)$/";
const dependencyArrays = [
  `CallExpression[callee.name=${hooks}] > ArrayExpression.arguments:nth-child(2)`,
  `CallExpression[callee.object.name=React][callee.property.name=${hooks}] > ArrayExpression.arguments:nth-child(2)`,
  "CallExpression[callee.name=useImperativeHandle] > ArrayExpression.arguments:nth-child(3)",
  "CallExpression[callee.object.name=React][callee.property.name=useImperativeHandle] > ArrayExpression.arguments:nth-child(3)",
].join(", ");

export default [
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    languageOptions: {
      parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    plugins: { perfectionist },
    rules: {
      "perfectionist/sort-imports": [
        "error",
        { ...byLength, groups: [], newlinesBetween: 0 },
      ],
      "perfectionist/sort-named-imports": ["error", byLength],
      "perfectionist/sort-objects": ["error", byLength],
      "perfectionist/sort-arrays": [
        "error",
        {
          ...byLength,
          useConfigurationIf: { matchesAstSelector: dependencyArrays },
        },
      ],
    },
  },
];
