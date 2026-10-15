# lengthfmt

A small Node.js CLI that sorts JavaScript and TypeScript code by line length,
shortest first. The sorting rules and parser are included.

```js
buildEditor({
  undo,
  redo,
  canvas,
  fontSize,
  strokeColor,
  strokeDashArray,
});
```

## Run from source

Requires Node.js 20.19+, 22.13+, or 24+ in the version ranges in `package.json`.

```sh
npm install
node bin/lengthfmt.js --help
```

Run from the project whose files you want to sort:

```sh
cd /path/to/your/project
node /path/to/lengthfmt/bin/lengthfmt.js src
node /path/to/lengthfmt/bin/lengthfmt.js --check src
```

## Package and install

Build an installable archive in this directory:

```sh
npm pack
npm install --global /path/to/lengthfmt/lengthfmt-0.1.0.tgz
```

Then use the command from any project:

```sh
lengthfmt src
lengthfmt src/editor.ts src/sidebar.tsx
lengthfmt "src/**/*.{ts,tsx}"
lengthfmt --check src
```

Quote globs so the program receives the pattern. Run inside the target project;
paths and patterns are resolved from your current directory. Use `--` before a
filename starting with a dash.

## Sorting behavior

- Import statements, all in one group, shortest first.
- Named imports inside braces.
- Object properties, including destructuring.
- Dependency arrays in `useMemo`, `useCallback`, `useEffect`, `useLayoutEffect`,
  `useInsertionEffect`, and `useImperativeHandle`. Both named calls and
  `React.use…` calls are supported.

Equal-length items retain their order. Ordinary arrays retain their order.
Side-effect imports keep their order, and object spreads remain boundaries.
Supported extensions: `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, `.cts`.

Sorting uses [ESLint Perfectionist](https://perfectionist.dev/), with its
`line-length` mode. This program changes ordering; use your usual formatter for
indentation and wrapping. Project ESLint configuration is not required.

Apply sorting where order is irrelevant: object iteration and property value
evaluation can depend on order, and imported modules can have initialization
effects. Hook matching uses the names above; renamed imports and custom hooks
are outside its scope.

## Exit codes

- `0`: successful; files were formatted, or a check found no changes.
- `1`: `--check` found files needing formatting; nothing was written.
- `2`: invalid arguments, missing files, or parsing/sorting errors.

All files in a batch are parsed and sorted before writing begins. A parsing or
sorting error prevents the batch from being written. Filesystem writes themselves
are not a transaction; an I/O error can leave a partially written batch.

## Development

```sh
npm test
```
