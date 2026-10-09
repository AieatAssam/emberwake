import js from '@eslint/js';
import globals from 'globals';

// Strict lint profile: CI runs with --max-warnings 0, so every finding fails the build.
export default [
  { ignores: ['dist/**', 'node_modules/**', '.playwright-mcp/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      // correctness
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-shadow': ['error', { builtinGlobals: false, hoist: 'functions' }],
      'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
      'no-unused-vars': ['error', { args: 'after-used', caughtErrors: 'none', ignoreRestSiblings: true }],
      'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'error',
      'no-unreachable-loop': 'error',
      'no-constructor-return': 'error',
      'no-promise-executor-return': 'error',
      'no-loss-of-precision': 'error',
      'array-callback-return': 'error',
      'consistent-return': 'error',
      'default-case-last': 'error',
      radix: 'error',
      // clarity / hygiene
      'no-var': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
      'object-shorthand': ['error', 'properties'],
      'no-useless-concat': 'error',
      'no-useless-return': 'error',
      'no-useless-rename': 'error',
      'no-useless-computed-key': 'error',
      'no-lonely-if': 'error',
      'no-else-return': ['error', { allowElseIf: true }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-alert': 'error',
      yoda: 'error',
    },
  },
  {
    // Node-side tooling (balance harness); callbacks passed to page.evaluate run in the browser
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-console': 'off' },
  },
];
