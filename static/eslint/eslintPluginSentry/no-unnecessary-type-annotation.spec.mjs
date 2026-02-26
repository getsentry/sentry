import {RuleTester} from 'eslint';
import typescript from 'typescript-eslint';

import rule from './no-unnecessary-type-annotation.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: typescript.parser,
    parserOptions: {
      projectService: {allowDefaultProject: ['*.ts']},
      tsconfigRootDir: import.meta.dirname,
    },
  },
});

ruleTester.run('no-unnecessary-type-annotation', rule, {
  valid: [
    // No annotation
    {code: 'const x = 5;', filename: 'valid.ts'},

    // Wider type than inferred (number vs literal 5)
    {code: 'const x: number = 5;', filename: 'valid.ts'},

    // Wider type annotation on const (string vs literal)
    {code: 'const x: string = "hello";', filename: 'valid.ts'},

    // Boolean literal widening
    {code: 'const x: boolean = true;', filename: 'valid.ts'},

    // let declaration (excluded)
    {code: 'let x: string = getString();', filename: 'valid.ts'},

    // Destructuring (excluded)
    {code: 'const {a}: {a: string} = obj;', filename: 'valid.ts'},

    // any annotation (excluded escape hatch)
    {code: 'const x: any = getValue();', filename: 'valid.ts'},

    // unknown annotation (excluded escape hatch)
    {code: 'const x: unknown = getValue();', filename: 'valid.ts'},

    // Empty array literal (excluded — now all array literals are skipped)
    {code: 'const arr: string[] = [];', filename: 'valid.ts'},

    // Non-empty array literal (excluded — all array literals are skipped)
    {code: 'const arr: number[] = [1, 2, 3];', filename: 'valid.ts'},

    // Empty object literal (excluded — now all object literals are skipped)
    {
      code: 'const obj: Record<string, number[]> = {};',
      filename: 'valid.ts',
    },

    // Non-empty object literal (excluded — all object literals are skipped)
    {
      code: 'const obj: { a: number } = { a: 1 };',
      filename: 'valid.ts',
    },

    // Arrow function (excluded — annotation provides contextual parameter types)
    {
      code: 'import {FocusEventHandler} from "react";\nconst handleBlur: FocusEventHandler<HTMLInputElement> = e => {};',
      filename: 'valid.ts',
    },

    // Function expression (excluded — annotation provides contextual parameter types)
    {
      code: 'const fn: (x: number) => number = function(x) { return x; };',
      filename: 'valid.ts',
    },
  ],

  invalid: [
    // const with redundant annotation matching return type of expression
    {
      code: 'function getString(): string { return ""; }\nconst s: string = getString();',
      output: 'function getString(): string { return ""; }\nconst s = getString();',
      errors: [{messageId: 'unnecessary'}],
      filename: 'invalid.ts',
    },
    {
      code: 'function getNumber(): number { return 0; }\nconst n: number = getNumber();',
      output: 'function getNumber(): number { return 0; }\nconst n = getNumber();',
      errors: [{messageId: 'unnecessary'}],
      filename: 'invalid.ts',
    },
  ],
});

console.log('All tests passed!');
