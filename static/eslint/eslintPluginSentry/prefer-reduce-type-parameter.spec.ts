import {RuleTester} from '@typescript-eslint/rule-tester';

import {preferReduceTypeParameter} from './prefer-reduce-type-parameter';

const ruleTester = new RuleTester();

ruleTester.run('prefer-reduce-type-parameter', preferReduceTypeParameter, {
  valid: [
    {
      name: 'reduce with type parameter — no assertions needed',
      code: `
        const result = items.reduce<{ sum: number }>((acc, item) => acc, { sum: 0 });
      `,
    },
    {
      name: 'reduce without initial value',
      code: `
        const result = items.reduce((acc, item) => acc + item);
      `,
    },
    {
      name: 'reduce with plain initial value — no assertions',
      code: `
        const result = items.reduce((acc, item) => acc, { sum: 0 });
      `,
    },
    {
      name: 'as const in initial value is fine',
      code: `
        const result = items.reduce((acc, item) => acc, { key: 'value' as const });
      `,
    },
    {
      name: 'non-reduce call with assertion in second arg',
      code: `
        someFunction(callback, value as string);
      `,
    },
  ],

  invalid: [
    {
      name: 'assertion in object initial value',
      code: `
        const result = items.reduce((acc, item) => acc, { legend: [] as string[] });
      `,
      errors: [{messageId: 'preferTypeParameter' as const}],
    },
    {
      name: 'multiple assertions in object initial value',
      code: `
        type SubLabel = { label: string };
        const result = items.reduce(
          (acc, item) => acc,
          { legend: [] as string[], subLabels: [] as SubLabel[] }
        );
      `,
      errors: [{messageId: 'preferTypeParameter' as const}],
    },
    {
      name: 'assertion in array initial value — autofixed',
      code: `
        const result = items.reduce((acc, item) => acc, [] as string[]);
      `,
      output: `
        const result = items.reduce<string[]>((acc, item) => acc, []);
      `,
      errors: [{messageId: 'preferTypeParameter' as const}],
    },
    {
      name: 'assertion on whole object initial value — autofixed',
      code: `
        const result = items.reduce((acc, item) => acc, {} as Record<string, any>);
      `,
      output: `
        const result = items.reduce<Record<string, any>>((acc, item) => acc, {});
      `,
      errors: [{messageId: 'preferTypeParameter' as const}],
    },
    {
      name: 'nested assertion in initial value',
      code: `
        const result = items.reduce((acc, item) => acc, { nested: { data: [] as number[] } });
      `,
      errors: [{messageId: 'preferTypeParameter' as const}],
    },
  ],
});
