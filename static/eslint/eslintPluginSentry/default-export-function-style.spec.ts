import {RuleTester} from 'eslint';

import defaultExportFunctionStyle from './default-export-function-style.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

ruleTester.run('default-export-function-style', defaultExportFunctionStyle, {
  valid: [
    // ===== STATEMENT MODE (default) =====
    // Already inline - function
    {
      code: 'export default function MyComponent() { return null; }',
    },
    // Already inline - class
    {
      code: 'export default class MyClass { }',
    },
    // Exporting a value (not a function/class)
    {
      code: 'const x = 5; export default x;',
    },
    // Exporting an expression directly
    {
      code: 'export default () => {};',
    },
    // Function with JSDoc comments (should preserve)
    {
      code: `
/**
 * Important documentation
 */
function MyComponent() { return null; }
export default MyComponent;`,
    },
    // Named exports don't trigger this rule
    {
      code: 'function MyComponent() { return null; } export { MyComponent };',
    },

    // ===== INLINE MODE =====
    // Separate declaration and export (inline mode)
    {
      code: 'function MyComponent() { return null; }\nexport default MyComponent;',
      options: ['inline'],
    },
    // Separate class and export (inline mode)
    {
      code: 'class MyClass { }\nexport default MyClass;',
      options: ['inline'],
    },
    // Variable with arrow function (inline mode)
    {
      code: 'const foo = () => {};\nexport default foo;',
      options: ['inline'],
    },
    // Already separate with JSDoc (inline mode)
    {
      code: `/**
 * Docs
 */
export default function foo() {}`,
      options: ['inline'],
    },
  ],

  invalid: [
    // ===== STATEMENT MODE (default) =====
    // Function declaration followed by separate export
    {
      code: 'function MyComponent() { return null; }\nexport default MyComponent;',
      errors: [{messageId: 'preferStatement'}],
      output: 'export default function MyComponent() { return null; }\n',
    },
    // Class declaration followed by separate export
    {
      code: 'class MyClass { }\nexport default MyClass;',
      errors: [{messageId: 'preferStatement'}],
      output: 'export default class MyClass { }\n',
    },
    // Function with parameters and body
    {
      code: `function AlertWizard(props) {
  const {organization} = props;
  return organization.name;
}

export default AlertWizard;`,
      errors: [{messageId: 'preferStatement'}],
      output: `export default function AlertWizard(props) {
  const {organization} = props;
  return organization.name;
}

`,
    },
    // Arrow function with block body
    {
      code: 'const Create = () => { return null; };\n\nexport default Create;',
      errors: [{messageId: 'preferStatement'}],
      output: 'export default function Create() { return null; }\n\n',
    },
    // Arrow function with expression body
    {
      code: 'const Create = () => null;\n\nexport default Create;',
      errors: [{messageId: 'preferStatement'}],
      output: 'export default function Create() { return null; }\n\n',
    },
    // Arrow function with parameters
    {
      code: 'const Add = (a, b) => a + b;\nexport default Add;',
      errors: [{messageId: 'preferStatement'}],
      output: 'export default function Add(a, b) { return a + b; }\n',
    },
    // Function expression
    {
      code: 'const MyFunc = function(x) { return x * 2; };\nexport default MyFunc;',
      errors: [{messageId: 'preferStatement'}],
      output: 'export default function MyFunc(x) { return x * 2; }\n',
    },

    // ===== INLINE MODE =====
    // Inline function export should be split
    {
      code: 'export default function MyComponent() { return null; }',
      options: ['inline'],
      errors: [{messageId: 'preferInline'}],
      output: 'function MyComponent() { return null; }\nexport default MyComponent;',
    },
    // Inline class export should be split
    {
      code: 'export default class MyClass { }',
      options: ['inline'],
      errors: [{messageId: 'preferInline'}],
      output: 'class MyClass { }\nexport default MyClass;',
    },
    // Inline function with parameters
    {
      code: 'export default function calculate(a, b) { return a + b; }',
      options: ['inline'],
      errors: [{messageId: 'preferInline'}],
      output: 'function calculate(a, b) { return a + b; }\nexport default calculate;',
    },
  ],
});
