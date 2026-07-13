import {RuleTester} from '@typescript-eslint/rule-tester';

import {preferStackForColumnFlex} from './prefer-stack-for-column-flex';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {jsx: true},
    },
  },
});

function invalid(name: string, code: string, output: string) {
  return {
    name,
    code,
    output,
    errors: [{messageId: 'preferStack'}],
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
    invalid(
      'Flex direction="column" swaps to Stack and renames the import',
      `import {Flex} from '@sentry/scraps/layout';
const x = <Flex direction="column" gap="md">child</Flex>;`,
      `import {Flex, Stack} from '@sentry/scraps/layout';
const x = <Stack gap="md">child</Stack>;`
    ),
    invalid(
      "Flex direction={'column'} expression form",
      `import {Flex} from '@sentry/scraps/layout';
const x = <Flex direction={'column'}>child</Flex>;`,
      `import {Flex, Stack} from '@sentry/scraps/layout';
const x = <Stack>child</Stack>;`
    ),
    invalid(
      'Stack already imported, no import change needed',
      `import {Flex, Stack} from '@sentry/scraps/layout';
const x = <Flex direction="column">child</Flex>;`,
      `import {Flex, Stack} from '@sentry/scraps/layout';
const x = <Stack>child</Stack>;`
    ),
    invalid(
      'Stack appended after existing named imports',
      `import {Container, Flex, Grid} from '@sentry/scraps/layout';
const x = <Flex direction="column">child</Flex>;`,
      `import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
const x = <Stack>child</Stack>;`
    ),
    invalid(
      'Stack inserted alphabetically before a later-sorting import',
      `import {Flex, Text} from '@sentry/scraps/layout';
const x = <Flex direction="column">child</Flex>;`,
      `import {Flex, Stack, Text} from '@sentry/scraps/layout';
const x = <Stack>child</Stack>;`
    ),
    invalid(
      'direction on its own line removes the whole line',
      `import {Flex} from '@sentry/scraps/layout';
const x = (
  <Flex
    gap="md"
    direction="column"
    align="start"
  >
    child
  </Flex>
);`,
      `import {Flex, Stack} from '@sentry/scraps/layout';
const x = (
  <Stack
    gap="md"
    align="start"
  >
    child
  </Stack>
);`
    ),
    invalid(
      'aliased Flex import',
      `import {Flex as F} from '@sentry/scraps/layout';
const x = <F direction="column">child</F>;`,
      `import {Flex as F, Stack} from '@sentry/scraps/layout';
const x = <Stack>child</Stack>;`
    ),
  ],
});
