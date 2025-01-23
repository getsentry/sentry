import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';

import type {DataFilter} from './types';

export const FILTER_OPTIONS: Array<SelectValue<DataFilter>> = [
  {label: t('Exclude'), value: 'exclude_outliers'},
  {label: t('Include'), value: 'all'},
];
