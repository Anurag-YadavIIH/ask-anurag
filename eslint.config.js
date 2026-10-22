import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/", ".vercel/"] },
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    extends: [tseslint.configs.recommended],
  },
  {
    files: ["api/**", "lib/**", "scripts/**", "tests/**", "evals/**", "content/**", "*.js", "*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["src/js/**"],
    languageOptions: { globals: globals.browser, sourceType: "module" },
  },
);
