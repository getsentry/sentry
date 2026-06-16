import type {SelectValue} from '@sentry/scraps/select';

import {t} from 'sentry/locale';

import {XAxisOption} from './types';

export const X_AXIS_SELECT_OPTIONS: Array<SelectValue<XAxisOption>> = [
  {label: t('LCP'), value: XAxisOption.LCP},
  {label: t('Duration'), value: XAxisOption.DURATION},
];
