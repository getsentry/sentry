import {RuleTester} from '@typescript-eslint/rule-tester';

import {preferStackForColumnFlex} from './prefer-stack-for-column-flex';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {jsx: true},
    },
  },
});

function errorWithSuggestion(output: string) {
  return {
    messageId: 'preferStack',
    suggestions: [
      {
        messageId: 'replaceWithStack',
        output,
      },
    ],
  } as const;
}

ruleTester.run('prefer-stack-for-column-flex', preferStackForColumnFlex, {
  valid: [
    {
      name: 'Flex with a row direction',
      code: `
        import {Flex} from '@sentry/scraps/layout';
        const x = <Flex direction="row">child</Flex>;
      `,
    },
    {
      name: 'Flex without a direction prop',
      code: `
        import {Flex} from '@sentry/scraps/layout';
        const x = <Flex gap="md">child</Flex>;
      `,
    },
    {
      name: 'Flex with a responsive direction',
      code: `
        import {Flex} from '@sentry/scraps/layout';
        const x = <Flex direction={{xs: 'column', md: 'row'}}>child</Flex>;
      `,
    },
    {
      name: 'Flex with a dynamic direction',
      code: `
        import {Flex} from '@sentry/scraps/layout';
        const x = <Flex direction={vertical ? 'column' : 'row'}>child</Flex>;
      `,
    },
    {
      name: 'Flex from a different package',
      code: `
        import {Flex} from 'other-package';
        const x = <Flex direction="column">child</Flex>;
      `,
    },
    {
      name: 'Stack already used',
      code: `
        import {Stack} from '@sentry/scraps/layout';
        const x = <Stack>child</Stack>;
      `,
    },
  ],
  invalid: [
    {
      name: 'Flex direction="column" swaps to Stack and renames the import',
      code: `import {Flex} from '@sentry/scraps/layout';
const x = <Flex direction="column" gap="md">child</Flex>;`,
      errors: [
        errorWithSuggestion(`import {Flex, Stack} from '@sentry/scraps/layout';
const x = <Stack gap="md">child</Stack>;`),
      ],
    },
    {
      name: "Flex direction={'column'} expression form",
      code: `import {Flex} from '@sentry/scraps/layout';
const x = <Flex direction={'column'}>child</Flex>;`,
      errors: [
        errorWithSuggestion(`import {Flex, Stack} from '@sentry/scraps/layout';
const x = <Stack>child</Stack>;`),
      ],
    },
    {
      name: 'Stack already imported, no import change needed',
      code: `import {Flex, Stack} from '@sentry/scraps/layout';
const x = <Flex direction="column">child</Flex>;`,
      errors: [
        errorWithSuggestion(`import {Flex, Stack} from '@sentry/scraps/layout';
const x = <Stack>child</Stack>;`),
      ],
    },
    {
      name: 'Stack appended after existing named imports',
      code: `import {Container, Flex, Grid} from '@sentry/scraps/layout';
const x = <Flex direction="column">child</Flex>;`,
      errors: [
        errorWithSuggestion(`import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
const x = <Stack>child</Stack>;`),
      ],
    },
    {
      name: 'Stack inserted alphabetically before a later-sorting import',
      code: `import {Flex, Text} from '@sentry/scraps/layout';
const x = <Flex direction="column">child</Flex>;`,
      errors: [
        errorWithSuggestion(`import {Flex, Stack, Text} from '@sentry/scraps/layout';
const x = <Stack>child</Stack>;`),
      ],
    },
    {
      name: 'direction on its own line removes the whole line',
      code: `import {Flex} from '@sentry/scraps/layout';
const x = (
  <Flex
    gap="md"
    direction="column"
    align="start"
  >
    child
  </Flex>
);`,
      errors: [
        errorWithSuggestion(`import {Flex, Stack} from '@sentry/scraps/layout';
const x = (
  <Stack
    gap="md"
    align="start"
  >
    child
  </Stack>
);`),
      ],
    },
    {
      name: 'aliased Flex import',
      code: `import {Flex as F} from '@sentry/scraps/layout';
const x = <F direction="column">child</F>;`,
      errors: [
        errorWithSuggestion(`import {Flex as F, Stack} from '@sentry/scraps/layout';
const x = <Stack>child</Stack>;`),
      ],
    },
  ],
});
