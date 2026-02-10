import {RuleTester} from 'eslint';

import {noCoreImport} from './no-core-import.mjs';

const ruleTester = new RuleTester();

ruleTester.run('no-core-import', noCoreImport, {
  valid: [
    {
      code: 'import {Button} from "@sentry/scraps";',
      filename: '/project/src/foo/file.ts',
    },
    {
      code: 'import {Text} from "@sentry/scraps/text";',
      filename: '/project/src/foo/file.ts',
    },
    {
      code: 'import {Flex} from "@sentry/scraps/layout";',
      filename: '/project/src/foo/file.ts',
    },
    {
      code: 'import x from "other-package";',
      filename: '/project/src/foo/file.ts',
    },
  ],

  invalid: [
    {
      code: 'import {Button} from "sentry/components/core/button";',
      filename: '/static/app/views/test.tsx',
      errors: [{messageId: 'forbidden'}],
      output: "import {Button} from '@sentry/scraps/button';",
    },
    {
      code: 'import {Flex} from "sentry/components/core/layout/flex";',
      filename: '/static/app/views/test.tsx',
      errors: [{messageId: 'forbidden'}],
      output: "import {Flex} from '@sentry/scraps/layout';",
    },
    {
      code: 'import {Grid} from "sentry/components/core/layout/grid/index";',
      filename: '/static/app/views/test.tsx',
      errors: [{messageId: 'forbidden'}],
      output: "import {Grid} from '@sentry/scraps/layout';",
    },
  ],
});
