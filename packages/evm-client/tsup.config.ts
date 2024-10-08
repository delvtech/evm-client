import { defineConfig } from "tsup";

export default defineConfig({
  // Splitting the entry points in foundational packages like this makes it
  // easier for wrapper packages to selectively re-export `*` from some entry
  // points and while augmenting or modifying others.
  entry: [
    "src/exports/cache.ts",
    "src/exports/contract.ts",
    "src/exports/errors.ts",
    "src/exports/index.ts",
    "src/exports/network.ts",
    "src/exports/stubs.ts",
  ],
  format: ["esm"],
  sourcemap: true,
  dts: true,
  clean: true,
  minify: true,
  shims: true,
  cjsInterop: true,
});
