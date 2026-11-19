import {RuleTester} from 'oxlint/plugins-dev';

import {preferRelativeChildImports} from './preferRelativeChildImports';

const ruleTester = new RuleTester();
const filename = `${process.cwd()}/static/app/components/widget.ts`;

ruleTester.run('prefer-relative-child-imports', preferRelativeChildImports, {
  valid: [
    {code: "import value from './value';", filename},
    {code: "import value from './nested/value';", filename},
    {code: "import value from '../utils/value';", filename},
    {code: "import value from 'sentry/utils/value';", filename},
    {code: "import value from 'sentry/componentsOther/value';", filename},
    {code: "import value from 'sentry-other/components/value';", filename},
    {code: "import value from 'sentry-test/components/value';", filename},
    {code: "import value from 'react';", filename},
    {code: "import value from 'sentry/components';", filename},
    {code: "import value from 'sentry/components/';", filename},
    {code: "import value from 'sentry/components/.';", filename},
    {code: "import value from 'sentry/components/..';", filename},
    {code: "import value from 'sentry/components/./value';", filename},
    {code: "import value from 'sentry/components/nested/../value';", filename},
    {code: "import value from 'sentry/components//value';", filename},
    {code: "import value from 'sentry/components/nested/';", filename},
    {
      code: "import value from 'sentry/value';",
      filename: `${process.cwd()}/static/outside.ts`,
    },
    {
      code: "import value from 'sentry/components/value';",
      filename: `${process.cwd()}/static/app-other/components/widget.ts`,
    },
    {
      code: "import value from 'sentry/value';",
      filename: `${process.cwd()}/static/widget.ts`,
    },
    {
      code: "import value from 'sentry/value';",
      filename: '<input>',
      options: [{rootDir: '.'}],
    },
    {
      code: "import value from 'sentry/value';",
      filename: '<text>',
      options: [{rootDir: '.'}],
    },
    {
      code: "import value from 'sentry';",
      filename: `${process.cwd()}/static/app/widget.ts`,
    },
    {
      code: "import value from 'sentry/components/value';",
      filename: `${process.cwd()}/custom/components/widget.ts`,
      options: [{prefix: '@app', rootDir: 'custom'}],
    },
    {
      code: "export {value} from 'sentry/components/value';",
      filename,
    },
    {
      code: "const value = import('sentry/components/value');",
      filename,
    },
  ],
  invalid: [
    {
      code: "import value from 'sentry/components/value';",
      filename,
      errors: [{messageId: 'relativeImport'}],
      output: 'import value from "./value";',
    },
    {
      code: 'import value from "sentry/components/nested/value";',
      filename,
      errors: [{messageId: 'relativeImport'}],
      output: 'import value from "./nested/value";',
    },
    {
      code: "import value from 'sentry/components/value';",
      filename: `${process.cwd()}/static/app/widget.ts`,
      errors: [{messageId: 'relativeImport'}],
      output: 'import value from "./components/value";',
    },
    {
      code: "import value from 'sentry/components/index';",
      filename,
      errors: [{messageId: 'relativeImport'}],
      output: 'import value from "./index";',
    },
    {
      code: "import value from 'sentry/components/nested';",
      filename,
      errors: [{messageId: 'relativeImport'}],
      output: 'import value from "./nested";',
    },
    {
      code: "import type {Value} from 'sentry/components/types';",
      filename,
      errors: [{messageId: 'relativeImport'}],
      output: 'import type {Value} from "./types";',
    },
    {
      code: "import 'sentry/components/setup';",
      filename,
      errors: [{messageId: 'relativeImport'}],
      output: 'import "./setup";',
    },
    {
      code: "import value from '@app/components/value';",
      filename: `${process.cwd()}/custom/components/widget.ts`,
      options: [{prefix: '@app', rootDir: 'custom'}],
      errors: [{messageId: 'relativeImport'}],
      output: 'import value from "./value";',
    },
    {
      code: "import value from '@app/components/value';",
      filename: `${process.cwd()}/custom/widget.ts`,
      options: [{prefix: '@app', rootDir: `${process.cwd()}/custom`}],
      errors: [{messageId: 'relativeImport'}],
      output: 'import value from "./components/value";',
    },
    {
      code: "import value from '@app/components/value';",
      filename,
      options: [{prefix: '@app'}],
      errors: [{messageId: 'relativeImport'}],
      output: 'import value from "./value";',
    },
    {
      code: "import value from 'sentry/components/value';",
      filename: `${process.cwd()}/custom/components/widget.ts`,
      options: [{rootDir: 'custom'}],
      errors: [{messageId: 'relativeImport'}],
      output: 'import value from "./value";',
    },
    {
      code: "import value from 'sentry/components/value';",
      filename,
      options: [{}],
      errors: [{messageId: 'relativeImport'}],
      output: 'import value from "./value";',
    },
    {
      code: "import value from 'sentry/components/..foo/value';",
      filename,
      errors: [{messageId: 'relativeImport'}],
      output: 'import value from "./..foo/value";',
    },
    {
      code: "import value from 'sentry/..foo/value';",
      filename: `${process.cwd()}/static/app/..foo/widget.ts`,
      errors: [{messageId: 'relativeImport'}],
      output: 'import value from "./value";',
    },
    {
      code: String.raw`import value from 'sentry/components/it\'s-a-value';`,
      filename,
      errors: [{messageId: 'relativeImport'}],
      output: `import value from "./it's-a-value";`,
    },
    {
      code: String.raw`import value from 'sentry/components/a"value';`,
      filename,
      errors: [{messageId: 'relativeImport'}],
      output: String.raw`import value from "./a\"value";`,
    },
    {
      code: String.raw`import value from 'sentry/components/a\\value';`,
      filename,
      errors: [{messageId: 'relativeImport'}],
      output: String.raw`import value from "./a\\value";`,
    },
  ],
});
