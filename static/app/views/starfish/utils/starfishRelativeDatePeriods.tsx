import omit from 'lodash/omit';

import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';

export const STARFISH_DEFAULT_RELATIVE_PERIODS = omit(DEFAULT_RELATIVE_PERIODS, [
  '14d',
  '30d',
  '90d',
]);
