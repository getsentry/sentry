import {t} from 'app/locale';

import {AlertRuleAggregations} from '../types';

export default function getMetricDisplayName(metric: AlertRuleAggregations): string {
  switch (metric) {
    case AlertRuleAggregations.UNIQUE_USERS:
      return t('Number of Users Affected');
    case AlertRuleAggregations.TOTAL:
      return t('Number of Events');

    default:
      return '';
  }
}
