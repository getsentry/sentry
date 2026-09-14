import {RuleTester, type InvalidTestCase} from '@typescript-eslint/rule-tester';

import {preferStackForColumnFlex} from './preferStackForColumnFlex';

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
    {
      name: 'namespace member that is not a layout import',
      code: `
        import * as Other from 'other-package';
        const x = <Other.Flex direction="column">child</Other.Flex>;
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
    invalid(
      'namespace import (any alias) renames the member and adds no import',
      `import * as Something from '@sentry/scraps/layout';
const x = <Something.Flex direction="column">child</Something.Flex>;`,
      `import * as Something from '@sentry/scraps/layout';
const x = <Something.Stack>child</Something.Stack>;`
    ),
    invalid(
      'preserves a comment preceding the removed direction attribute',
      `import {Flex} from '@sentry/scraps/layout';
const x = (
  <Flex
    gap="md"
    // keep this comment
    direction="column"
  >
    child
  </Flex>
);`,
      `import {Flex, Stack} from '@sentry/scraps/layout';
const x = (
  <Stack
    gap="md"
    // keep this comment
  >
    child
  </Stack>
);`
    ),
  ],
});
