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
      name: 'assertion in generic call without explicit type args — drives inference',
      code: `
        declare function generic<T>(value: T): T;
        generic([] as string[]);
      `,
      filename: 'valid.ts',
    },
    {
      name: 'assertion in reduce initial value — drives generic inference',
      code: `
        declare const items: number[];
        items.reduce((acc, item) => acc, [] as string[]);
      `,
      filename: 'valid.ts',
    },
    {
      name: 'assertion inside object arg to generic call — drives inference',
      code: `
        declare function generic<T>(opts: T): T;
        generic({ data: [] as string[] });
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
    {
      name: 'as unknown as T — double assertion escape hatch (function arg)',
      code: `
        declare function accept(x: string): void;
        declare const value: number;
        accept(value as unknown as string);
      `,
      filename: 'valid.ts',
    },
    {
      name: 'as unknown as T — double assertion escape hatch (variable)',
      code: `
        declare const value: number;
        const x: string = value as unknown as string;
      `,
      filename: 'valid.ts',
    },
    {
      name: 'as any as T — double assertion escape hatch',
      code: `
        declare function accept(x: string): void;
        declare const value: number;
        accept(value as any as string);
      `,
      filename: 'valid.ts',
    },
    {
      name: 'assertion in spread — needed to satisfy object type constraint (TS2698)',
      code: `
        declare const config: { static: string | { dir: string } };
        const obj: Record<string, unknown> = { ...(config.static as Record<PropertyKey, unknown>) };
      `,
      filename: 'valid.ts',
    },
    {
      name: 'narrowing from any — adds type safety',
      code: `
        declare function accept(x: string): void;
        declare const value: any;
        accept(value as string);
      `,
      filename: 'valid.ts',
    },
    {
      name: 'narrowing from any in object literal — adds type safety',
      code: `
        declare const value: any;
        const obj: { x: string } = { x: value as string };
      `,
      filename: 'valid.ts',
    },
    {
      name: 'assertion in spread — even when original is an object type',
      code: `
        declare const config: { dir: string };
        const obj: Record<string, unknown> = { ...(config as Record<PropertyKey, unknown>) };
      `,
      filename: 'valid.ts',
    },
    {
      name: 'assertion in variable declaration — excluded from rule scope',
      code: `
        declare const value: string | number;
        const x: string | number = value as string;
      `,
      filename: 'valid.ts',
    },
    {
      name: 'tuple assertion — array literal is not assignable to tuple type',
      code: `
        declare function accept(x: [number, string][]): void;
        const choices = [1, 2].map(n => [n, String(n)] as [number, string]);
        accept(choices);
      `,
      filename: 'valid.ts',
    },
    {
      name: 'assertion in assignment — narrows union (dom pattern)',
      code: `
        declare let dom: HTMLDivElement | Text | null;
        dom = dom as HTMLDivElement;
      `,
      filename: 'valid.ts',
    },
  ],

  invalid: [
    {
      name: 'unnecessary narrowing — parenthesized expression preserves closing paren',
      code: `
        declare function map(fn: (x: number) => {a: number}): void;
        map(x => ({a: x}) as {a: number});
      `,
      output: `
        declare function map(fn: (x: number) => {a: number}): void;
        map(x => ({a: x}));
      `,
      errors: [{messageId: 'unnecessary' as const}],
      filename: 'invalid.ts',
    },
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
  ],
});
