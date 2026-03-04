import {RuleTester} from '@typescript-eslint/rule-tester';
import typescript from 'typescript-eslint';

import {noUnnecessaryTypeAnnotation} from './no-unnecessary-type-annotation';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: typescript.parser,
    parserOptions: {
      projectService: {allowDefaultProject: ['*.ts']},
      tsconfigRootDir: __dirname,
    },
  },
});

ruleTester.run('no-unnecessary-type-annotation', noUnnecessaryTypeAnnotation, {
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

    // Call expression with untyped callback (excluded — annotation provides
    // contextual typing that flows through the generic into callback params)
    {
      code: 'declare function useCallback<T>(fn: T): T;\ntype Reducer = (state: number, action: string) => number;\nconst reducer: Reducer = useCallback((state, action) => state, []);',
      filename: 'valid.ts',
    },

    // Ternary with untyped arrow function in alternate branch
    {
      code: 'declare function typed(): (x: number) => number;\nconst fn: (x: number) => number = true ? typed() : x => x;',
      filename: 'valid.ts',
    },

    // Ternary with untyped arrow function in consequent branch
    {
      code: 'declare function typed(): (x: number) => number;\nconst fn: (x: number) => number = true ? x => x : typed();',
      filename: 'valid.ts',
    },

    // Logical OR with untyped arrow function
    {
      code: 'declare const maybeFn: ((x: number) => number) | null;\nconst fn: (x: number) => number = maybeFn || (x => x);',
      filename: 'valid.ts',
    },

    // Function returning any — annotation narrows the type
    {
      code: 'declare function getAny(): any;\nconst x: string = getAny();',
      filename: 'valid.ts',
    },

    // Function returning Promise<any> — annotation narrows the type argument
    {
      code: 'declare function getPromise(): Promise<any>;\nconst p: Promise<string> = getPromise();',
      filename: 'valid.ts',
    },

    // Nested any in type arguments (e.g. Array<any>)
    {
      code: 'declare function getArr(): Array<any>;\nconst a: Array<number> = getArr();',
      filename: 'valid.ts',
    },

    // Annotation adds index signature — Record<string, T> vs {}
    {
      code: 'type TagCollection = Record<string, { key: string }>;\ndeclare function getObj(): {};\nconst x: TagCollection = getObj();',
      filename: 'valid.ts',
    },

    // Annotation widens with optional properties — TrendsQuery pattern
    {
      code: 'type Base = { a: string };\ntype Extended = Base & { extra?: number };\ndeclare function getBase(): Base;\nconst x: Extended = getBase();',
      filename: 'valid.ts',
    },
  ],

  invalid: [
    // const with redundant annotation matching return type of expression
    {
      code: 'function getString(): string { return ""; }\nconst s: string = getString();',
      output: 'function getString(): string { return ""; }\nconst s = getString();',
      errors: [{messageId: 'unnecessary' as const}],
      filename: 'invalid.ts',
    },
    {
      code: 'function getNumber(): number { return 0; }\nconst n: number = getNumber();',
      output: 'function getNumber(): number { return 0; }\nconst n = getNumber();',
      errors: [{messageId: 'unnecessary' as const}],
      filename: 'invalid.ts',
    },
  ],
});
