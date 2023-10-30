import {t} from 'sentry/locale';
import {SelectValue} from 'sentry/types';

import {XAxisOption} from './types';

export const X_AXIS_SELECT_OPTIONS: SelectValue<XAxisOption>[] = [
  {label: t('LCP'), value: XAxisOption.LCP},
  {label: t('Duration'), value: XAxisOption.DURATION},
];
