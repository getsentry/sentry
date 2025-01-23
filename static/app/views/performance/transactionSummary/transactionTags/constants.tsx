import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';

import {XAxisOption} from './types';

export const X_AXIS_SELECT_OPTIONS: Array<SelectValue<XAxisOption>> = [
  {label: t('LCP'), value: XAxisOption.LCP},
  {label: t('Duration'), value: XAxisOption.DURATION},
];
