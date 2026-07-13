import {RuleTester, type InvalidTestCase} from '@typescript-eslint/rule-tester';

import {preferStackForColumnFlex} from './prefer-stack-for-column-flex';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {jsx: true},
    },
  },
});

function invalid(
  name: string,
  code: string,
  output: string
): InvalidTestCase<'preferStack', never[]> {
  return {name, code, output, errors: [{messageId: 'preferStack'}]};
}

ruleTester.run('prefer-stack-for-column-flex', preferStackForColumnFlex, {
  valid: [
    {
      name: 'Flex with a non-column direction',
      code: `
        import {Flex} from '@sentry/scraps/layout';
        const x = <Flex direction="row">child</Flex>;
      `,
    },
    {
      name: 'Flex with a responsive direction is not matched',
      code: `
        import {Flex} from '@sentry/scraps/layout';
        const x = <Flex direction={{xs: 'column', md: 'row'}}>child</Flex>;
      `,
    },
    {
      name: 'Flex with a dynamic direction is not matched',
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
  ],
  invalid: [
    invalid(
      'converts to Stack, drops direction, and adds the import',
      `import {Flex} from '@sentry/scraps/layout';
const x = <Flex direction="column" gap="md">child</Flex>;`,
      `import {Flex, Stack} from '@sentry/scraps/layout';
const x = <Stack gap="md">child</Stack>;`
    ),
    invalid(
      'reuses an existing Stack import',
      `import {Flex, Stack} from '@sentry/scraps/layout';
const x = <Flex direction="column">child</Flex>;`,
      `import {Flex, Stack} from '@sentry/scraps/layout';
const x = <Stack>child</Stack>;`
    ),
  ],
});
