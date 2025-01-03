import type {SelectValue} from 'sentry/types/core';

import {t} from 'sentry/locale';

import {XAxisOption} from './types';

export const X_AXIS_SELECT_OPTIONS: SelectValue<XAxisOption>[] = [
  {label: t('LCP'), value: XAxisOption.LCP},
  {label: t('Duration'), value: XAxisOption.DURATION},
];
