import {RuleTester} from 'oxlint/plugins-dev';

import {preferStackForColumnFlex} from './preferStackForColumnFlex';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {jsx: true},
      lang: 'tsx',
    },
  },
});

function invalid(name: string, code: string, output: string): RuleTester.InvalidTestCase {
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
    {
      name: 'Flex binding shadowed by a parameter',
      code: `
        import {Flex} from '@sentry/scraps/layout';
        function Example(Flex) {
          return <Flex direction="column">child</Flex>;
        }
      `,
    },
    {
      name: 'type-only Flex import',
      code: `
        import type {Flex} from '@sentry/scraps/layout';
        const x = <Flex direction="column">child</Flex>;
      `,
    },
    {
      name: 'namespaced direction attribute',
      code: `
        import {Flex} from '@sentry/scraps/layout';
        const x = <Flex {...props} xml:direction="column">child</Flex>;
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
    invalid(
      'keeps the line break after a line comment preceding the removed direction attribute',
      `import {Flex} from '@sentry/scraps/layout';
const x = <Flex gap="md" // note
  direction="column">a</Flex>;`,
      `import {Flex, Stack} from '@sentry/scraps/layout';
const x = <Stack gap="md" // note
  >a</Stack>;`
    ),
    invalid(
      'expression container column direction',
      `import {Flex} from '@sentry/scraps/layout';
const x = <Flex gap="md" direction={'column'}>child</Flex>;`,
      `import {Flex, Stack} from '@sentry/scraps/layout';
const x = <Stack gap="md">child</Stack>;`
    ),
    invalid(
      'self-closing Flex',
      `import {Flex} from '@sentry/scraps/layout';
const x = <Flex direction="column" />;`,
      `import {Flex, Stack} from '@sentry/scraps/layout';
const x = <Stack />;`
    ),
    invalid(
      'self-closing namespace Flex',
      `import * as Layout from '@sentry/scraps/layout';
const x = <Layout.Flex direction="column" />;`,
      `import * as Layout from '@sentry/scraps/layout';
const x = <Layout.Stack />;`
    ),
    invalid(
      'inserts Stack before a later named import',
      `import {Flex, Surface} from '@sentry/scraps/layout';
const x = <Flex direction="column">child</Flex>;`,
      `import {Flex, Stack, Surface} from '@sentry/scraps/layout';
const x = <Stack>child</Stack>;`
    ),
    invalid(
      'inserts Stack before a later string-named import',
      `import {Flex, 'Surface' as Surface} from '@sentry/scraps/layout';
const x = <Flex direction="column">child</Flex>;`,
      `import {Flex, Stack, 'Surface' as Surface} from '@sentry/scraps/layout';
const x = <Stack>child</Stack>;`
    ),
    invalid(
      'reuses an aliased Stack import',
      `import {Flex as F, Stack as S} from '@sentry/scraps/layout';
const x = <F direction="column">child</F>;`,
      `import {Flex as F, Stack as S} from '@sentry/scraps/layout';
const x = <S>child</S>;`
    ),
    invalid(
      'adds Stack to the value import when a type import comes first',
      `import type {FlexProps} from '@sentry/scraps/layout';
import {Flex} from '@sentry/scraps/layout';
const x = <Flex direction="column">child</Flex>;`,
      `import type {FlexProps} from '@sentry/scraps/layout';
import {Flex, Stack} from '@sentry/scraps/layout';
const x = <Stack>child</Stack>;`
    ),
    invalid(
      'adds Stack to the named import when a namespace import comes first',
      `import * as Layout from '@sentry/scraps/layout';
import {Flex} from '@sentry/scraps/layout';
const x = <Flex direction="column">child</Flex>;`,
      `import * as Layout from '@sentry/scraps/layout';
import {Flex, Stack} from '@sentry/scraps/layout';
const x = <Stack>child</Stack>;`
    ),
    invalid(
      'removes a direction attribute on its own line',
      `import {Flex} from '@sentry/scraps/layout';
const x = (
  <Flex
    direction="column"
    gap="md"
  >
    child
  </Flex>
);`,
      `import {Flex, Stack} from '@sentry/scraps/layout';
const x = (
  <Stack
    gap="md"
  >
    child
  </Stack>
);`
    ),
    {
      name: 'does not fix when a spread before direction may override it',
      code: `import {Flex} from '@sentry/scraps/layout';
const x = <Flex {...props} direction="column">child</Flex>;`,
      output: null,
      errors: [{messageId: 'preferStack'}],
    },
    invalid(
      'fixes when the spread comes after direction',
      `import {Flex} from '@sentry/scraps/layout';
const x = <Flex direction="column" {...props}>child</Flex>;`,
      `import {Flex, Stack} from '@sentry/scraps/layout';
const x = <Stack {...props}>child</Stack>;`
    ),
  ],
});
