import {RuleTester} from '@typescript-eslint/rule-tester';

import {noUnnecessaryTypeAnnotation} from './no-unnecessary-type-annotation';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: {allowDefaultProject: ['*.ts']},
      tsconfigRootDir: __dirname,
    },
  },
});

ruleTester.run('no-unnecessary-type-annotation', noUnnecessaryTypeAnnotation, {
  valid: [
    {
      name: 'no annotation',
      code: 'const x = 5;',
      filename: 'valid.ts',
    },
    {
      name: 'wider type than inferred (number vs literal 5)',
      code: 'const x: number = 5;',
      filename: 'valid.ts',
    },
    {
      name: 'wider type annotation on const (string vs literal)',
      code: 'const x: string = "hello";',
      filename: 'valid.ts',
    },
    {
      name: 'boolean literal widening',
      code: 'const x: boolean = true;',
      filename: 'valid.ts',
    },
    {
      name: 'let with wider type (allows reassignment to other values)',
      code: 'let x: string | number = getString();',
      filename: 'valid.ts',
    },
    {
      name: 'destructuring (excluded)',
      code: 'const {a}: {a: string} = obj;',
      filename: 'valid.ts',
    },
    {
      name: 'any annotation (escape hatch)',
      code: 'const x: any = getValue();',
      filename: 'valid.ts',
    },
    {
      name: 'unknown annotation (escape hatch)',
      code: 'const x: unknown = getValue();',
      filename: 'valid.ts',
    },
    {
      name: 'empty array literal (excluded)',
      code: 'const arr: string[] = [];',
      filename: 'valid.ts',
    },
    {
      name: 'non-empty array literal (excluded)',
      code: 'const arr: number[] = [1, 2, 3];',
      filename: 'valid.ts',
    },
    {
      name: 'empty object literal (excluded)',
      code: 'const obj: Record<string, number[]> = {};',
      filename: 'valid.ts',
    },
    {
      name: 'non-empty object literal (excluded)',
      code: 'const obj: { a: number } = { a: 1 };',
      filename: 'valid.ts',
    },
    {
      name: 'arrow function (annotation provides contextual parameter types)',
      code: `
        import {FocusEventHandler} from "react";
        const handleBlur: FocusEventHandler<HTMLInputElement> = e => {};
      `,
      filename: 'valid.ts',
    },
    {
      name: 'function expression (annotation provides contextual parameter types)',
      code: 'const fn: (x: number) => number = function(x) { return x; };',
      filename: 'valid.ts',
    },
    {
      name: 'call expression with untyped callback (contextual typing flows through generic)',
      code: `
        declare function useCallback<T>(fn: T): T;
        type Reducer = (state: number, action: string) => number;
        const reducer: Reducer = useCallback((state, action) => state, []);
      `,
      filename: 'valid.ts',
    },
    {
      name: 'ternary with untyped arrow function in alternate branch',
      code: `
        declare function typed(): (x: number) => number;
        const fn: (x: number) => number = true ? typed() : x => x;
      `,
      filename: 'valid.ts',
    },
    {
      name: 'ternary with untyped arrow function in consequent branch',
      code: `
        declare function typed(): (x: number) => number;
        const fn: (x: number) => number = true ? x => x : typed();
      `,
      filename: 'valid.ts',
    },
    {
      name: 'logical OR with untyped arrow function',
      code: `
        declare const maybeFn: ((x: number) => number) | null;
        const fn: (x: number) => number = maybeFn || (x => x);
      `,
      filename: 'valid.ts',
    },
    {
      name: 'function returning any — annotation narrows the type',
      code: `
        declare function getAny(): any;
        const x: string = getAny();
      `,
      filename: 'valid.ts',
    },
    {
      name: 'function returning Promise<any> — annotation narrows the type argument',
      code: `
        declare function getPromise(): Promise<any>;
        const p: Promise<string> = getPromise();
      `,
      filename: 'valid.ts',
    },
    {
      name: 'nested any in type arguments (e.g. Array<any>)',
      code: `
        declare function getArr(): Array<any>;
        const a: Array<number> = getArr();
      `,
      filename: 'valid.ts',
    },
    {
      name: 'annotation adds index signature — Record<string, T> vs {}',
      code: `
        type TagCollection = Record<string, { key: string }>;
        declare function getObj(): {};
        const x: TagCollection = getObj();
      `,
      filename: 'valid.ts',
    },
    {
      name: 'annotation widens with optional properties',
      code: `
        type Base = { a: string };
        type Extended = Base & { extra?: number };
        declare function getBase(): Base;
        const x: Extended = getBase();
      `,
      filename: 'valid.ts',
    },
    {
      name: 'let with generic type parameter — annotation widens from generic',
      code: `
        function example<T extends string>(value: T) {
          let url: string = value;
          return url;
        }
      `,
      filename: 'valid.ts',
    },
    {
      name: 'const with generic type parameter — annotation widens from generic',
      code: `
        function example<T extends string>(value: T) {
          const url: string = value;
          return url;
        }
      `,
      filename: 'valid.ts',
    },
  ],

  invalid: [
    {
      name: 'const with redundant string annotation',
      code: `
        function getString(): string { return ""; }
        const s: string = getString();
      `,
      output: `
        function getString(): string { return ""; }
        const s = getString();
      `,
      errors: [{messageId: 'unnecessary' as const}],
      filename: 'invalid.ts',
    },
    {
      name: 'const with redundant number annotation',
      code: `
        function getNumber(): number { return 0; }
        const n: number = getNumber();
      `,
      output: `
        function getNumber(): number { return 0; }
        const n = getNumber();
      `,
      errors: [{messageId: 'unnecessary' as const}],
      filename: 'invalid.ts',
    },
    {
      name: 'let with redundant annotation from function return',
      code: `
        declare function getString(): string;
        let s: string = getString();
      `,
      output: `
        declare function getString(): string;
        let s = getString();
      `,
      errors: [{messageId: 'unnecessary' as const}],
      filename: 'invalid.ts',
    },
    {
      name: 'let with literal that TypeScript already widens',
      code: "let x: string = '';",
      output: "let x = '';",
      errors: [{messageId: 'unnecessary' as const}],
      filename: 'invalid.ts',
    },
  ],
});
