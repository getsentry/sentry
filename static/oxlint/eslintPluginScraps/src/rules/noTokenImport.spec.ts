import {RuleTester} from 'oxlint/plugins-dev';

import {noTokenImport} from './noTokenImport';

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
    {
      code: 'import {color} from "@sentry/scraps/tokens/color";',
      filename: '/static/app/utils/theme/theme.tsx',
    },
    {
      code: 'import {size} from "@sentry/scraps/tokens/size";',
      filename: '/static/packages/scraps/src/theme/base.tsx',
    },
    {
      code: 'import {size} from "@sentry/scraps/tokens";',
      filename: '/static/packages/scraps/src/tokens/index.ts',
    },
  ],

  invalid: [
    {
      code: 'import {colors} from "sentry/utils/theme/scraps/colors";',
      filename: '/static/app/index.tsx',
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: 'import {size} from "@sentry/scraps/tokens";',
      filename: '/static/app/index.tsx',
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: 'import {color} from "@sentry/scraps/tokens/color";',
      filename: '/static/packages/scraps/src/text/text.tsx',
      errors: [{messageId: 'forbidden'}],
    },
  ],
});
