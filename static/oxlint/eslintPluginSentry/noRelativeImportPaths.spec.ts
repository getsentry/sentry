import {RuleTester} from 'oxlint/plugins-dev';

import {noRelativeImportPaths} from './noRelativeImportPaths';

const ruleTester = new RuleTester();
const options = [
  {
    prefix: 'sentry',
    rootDir: 'static/app',
    allowSameFolder: true,
  },
];

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
    {
      code: "import value from '../../';",
      filename: `${process.cwd()}/static/app/components/widget.ts`,
      options,
    },
    {
      code: "import value from '../app/value';",
      filename: `${process.cwd()}/static/outside/widget.ts`,
      options,
    },
    {
      code: "import value from './value';",
      filename: `${process.cwd()}/static/outside/widget.ts`,
      options: [{prefix: 'sentry', rootDir: 'static/app'}],
    },
    {
      code: "import value from '../value';",
      filename: `${process.cwd()}/static/app/components/widget.ts`,
      options: [{...options[0], allowedDepth: 1}],
    },
    {
      code: "import value from '../nested/../value';",
      filename: `${process.cwd()}/static/app/components/widget.ts`,
      options: [{...options[0], allowedDepth: 1}],
    },
    {
      code: "import value from 'sentry/utils/value';",
      filename: `${process.cwd()}/static/app/components/widget.ts`,
      options: [{prefix: 'sentry', rootDir: 'static/app'}],
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
    {
      code: "import value from '../utils/value';",
      filename: `${process.cwd()}/static/app/..foo/widget.ts`,
      options,
      errors: [{messageId: 'absoluteImport'}],
      output: "import value from 'sentry/utils/value';",
    },
    {
      code: "import value from '../../utils/value';",
      filename: `${process.cwd()}/static/app/components/nested/widget.ts`,
      options: [{...options[0], allowedDepth: 1}],
      errors: [{messageId: 'absoluteImport'}],
      output: "import value from 'sentry/utils/value';",
    },
    {
      code: "import value from './value';",
      filename: `${process.cwd()}/static/app/components/widget.ts`,
      options: [{prefix: 'sentry', rootDir: 'static/app'}],
      errors: [{messageId: 'absoluteImport'}],
      output: "import value from 'sentry/components/value';",
    },
  ],
});
