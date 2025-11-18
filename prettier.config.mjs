/**
 * @type {import("prettier").Config}
 */
const config = {
  plugins: ['@prettier/plugin-oxc', '@ianvs/prettier-plugin-sort-imports'],
  importOrder: [
    // Node.js builtins.
    '<BUILTIN_MODULES>',
    '',
    // Packages. `react` related packages come first.
    '^react',
    '<THIRD_PARTY_MODULES>',
    '',
    // Test should be separate from the app
    '^(sentry-test|getsentry-test)(/.*|$)',
    '',
    // Internal packages.
    '^(sentry-locale|sentry-images)(/.*|$)',
    '',
    '^@sentry/scraps(/.*|$)',
    '',
    '^(app|sentry)(/.*|$)',
    '',
    // Getsentry packages.
    '^(admin|getsentry)(/.*|$)',
    '',
    // Style imports.
    String.raw`^.+\.less$`,
    '',
    // Parent imports. Put `..` last.
    String.raw`^\.\.(?!/?$)`,
    String.raw`^\.\./?$`,
    '',
    // Other relative imports. Put same-folder imports and `.` last.
    String.raw`^\./(?=.*/)(?!/?$)`,
    String.raw`^\.(?!/?$)`,
    String.raw`^\./?$`,
    // newline after imports
    '',
  ],
  bracketSpacing: false,
  bracketSameLine: false,
  printWidth: 90,
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  useTabs: false,
  arrowParens: 'avoid',
};

export default config;
