import {RuleTester} from '@typescript-eslint/rule-tester';

import {noRelativeImportPaths} from './noRelativeImportPaths';

const ruleTester = new RuleTester();
const options = [
  {
    prefix: 'sentry',
    rootDir: 'static/app',
    allowSameFolder: true,
  },
] as const;

ruleTester.run('no-relative-import-paths', noRelativeImportPaths, {
  valid: [
    {
      code: "import value from './value';",
      filename: `${process.cwd()}/static/app/components/widget.ts`,
      options,
    },
    {
      code: "import value from '../../../outside';",
      filename: `${process.cwd()}/static/app/components/widget.ts`,
      options,
    },
    "import value from 'sentry/utils/value';",
  ],
  invalid: [
    {
      code: "import value from '../utils/value';",
      filename: `${process.cwd()}/static/app/components/widget.ts`,
      options,
      errors: [{messageId: 'absoluteImport'}],
      output: "import value from 'sentry/utils/value';",
    },
  ],
});
