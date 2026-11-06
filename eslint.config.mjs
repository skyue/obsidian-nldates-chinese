import obsidian from 'eslint-plugin-obsidianmd';
import tseslint from 'typescript-eslint';
export default tseslint.config({ignores:['main.js','node_modules/**']}, ...tseslint.configs.recommendedTypeChecked, {files:['src/**/*.ts'],languageOptions:{parserOptions:{project:'./tsconfig.json',tsconfigRootDir:import.meta.dirname}},plugins:{obsidianmd:obsidian},rules:{'obsidianmd/prefer-create-el':'error','obsidianmd/settings-tab/prefer-setting-definitions':'error','@typescript-eslint/no-unnecessary-type-assertion':'error'}});
