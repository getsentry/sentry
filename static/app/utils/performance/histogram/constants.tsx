import {t} from 'app/locale';
import {SelectValue} from 'app/types';

import {DataFilter} from './types';

export const FILTER_OPTIONS: SelectValue<DataFilter>[] = [
  {label: t('Exclude'), value: 'exclude_outliers'},
  {label: t('Include'), value: 'all'},
];
