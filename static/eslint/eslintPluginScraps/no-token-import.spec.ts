import {RuleTester} from 'eslint';

import noTokenImport from './no-token-import.mjs';

const ruleTester = new RuleTester();

ruleTester.run('no-token-import', noTokenImport, {
  valid: [
    {
      code: 'import x from "other-package";',
      filename: '/project/src/foo/file.ts',
    },
    {
      code: 'const x = require("other-package");',
      filename: '/project/src/foo/file.js',
    },

    {
      code: 'import {colors} from "sentry/utils/theme/scraps/colors";',
      filename: '/static/app/utils/theme/theme.tsx',
    },
  ],

  invalid: [
    {
      code: 'import {colors} from "sentry/utils/theme/scraps/colors";',
      filename: '/static/app/index.tsx',
      errors: [{messageId: 'forbidden'}],
    },
  ],
});
