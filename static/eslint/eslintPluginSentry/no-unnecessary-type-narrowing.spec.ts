import {RuleTester} from '@typescript-eslint/rule-tester';

import {noUnnecessaryTypeNarrowing} from './no-unnecessary-type-narrowing';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: {allowDefaultProject: ['*.ts']},
      tsconfigRootDir: __dirname,
    },
  },
});

ruleTester.run('no-unnecessary-type-narrowing', noUnnecessaryTypeNarrowing, {
  valid: [
    {
      name: 'no assertion',
      code: `
        declare function accept(x: string): void;
        declare const value: string;
        accept(value);
      `,
      filename: 'valid.ts',
    },
    {
      name: 'assertion needed — original type is not assignable to target',
      code: `
        declare function accept(x: string): void;
        declare const value: string | number;
        accept(value as string);
      `,
      filename: 'valid.ts',
    },
    {
      name: 'assertion to any (escape hatch)',
      code: `
        declare function accept(x: string): void;
        declare const value: string;
        accept(value as any);
      `,
      filename: 'valid.ts',
    },
    {
      name: 'assertion to unknown (escape hatch)',
      code: `
        declare function accept(x: unknown): void;
        declare const value: string;
        accept(value as unknown);
      `,
      filename: 'valid.ts',
    },
    {
      name: 'no contextual type — standalone variable',
      code: `
        declare const value: string | number;
        const x = value as string;
      `,
      filename: 'valid.ts',
    },
    {
      name: 'assertion needed in object literal — property type is narrower',
      code: `
        declare const value: string | number;
        const obj: { x: string } = { x: value as string };
      `,
      filename: 'valid.ts',
    },
    {
      name: 'as const is always allowed',
      code: `
        const obj: { x: string } = { x: 'hello' as const };
      `,
      filename: 'valid.ts',
    },
    {
      name: 'assertion needed — narrows null away and target does not accept null',
      code: `
        declare function accept(x: string): void;
        declare const value: string | null;
        accept(value as string);
      `,
      filename: 'valid.ts',
    },
  ],

  invalid: [
    {
      name: 'unnecessary narrowing — original type assignable to parameter type',
      code: `
        declare function accept(x: string | number): void;
        declare const value: string | number;
        accept(value as string);
      `,
      output: `
        declare function accept(x: string | number): void;
        declare const value: string | number;
        accept(value);
      `,
      errors: [{messageId: 'unnecessary' as const}],
      filename: 'invalid.ts',
    },
    {
      name: 'unnecessary narrowing in object literal property',
      code: `
        declare const value: string | number | undefined;
        const obj: { x: string | number | undefined } = { x: value as string };
      `,
      output: `
        declare const value: string | number | undefined;
        const obj: { x: string | number | undefined } = { x: value };
      `,
      errors: [{messageId: 'unnecessary' as const}],
      filename: 'invalid.ts',
    },
    {
      name: 'unnecessary narrowing — drops null but target accepts it',
      code: `
        declare function accept(x: string | null | undefined): void;
        declare const value: string | null | undefined;
        accept(value as string | undefined);
      `,
      output: `
        declare function accept(x: string | null | undefined): void;
        declare const value: string | null | undefined;
        accept(value);
      `,
      errors: [{messageId: 'unnecessary' as const}],
      filename: 'invalid.ts',
    },
    {
      name: 'unnecessary narrowing — variable with type annotation',
      code: `
        declare const value: string | number;
        const x: string | number = value as string;
      `,
      output: `
        declare const value: string | number;
        const x: string | number = value;
      `,
      errors: [{messageId: 'unnecessary' as const}],
      filename: 'invalid.ts',
    },
  ],
});
