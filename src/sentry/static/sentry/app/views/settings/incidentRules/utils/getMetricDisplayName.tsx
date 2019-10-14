import {t} from 'app/locale';

import {AlertRuleAggregations} from '../types';

export default function getMetricDisplayName(metric: AlertRuleAggregations): string {
  switch (metric) {
    case AlertRuleAggregations.UNIQUE_USERS:
      return t('Users Affected');
    case AlertRuleAggregations.TOTAL:
      return t('Events');

    default:
      return '';
  }
}
