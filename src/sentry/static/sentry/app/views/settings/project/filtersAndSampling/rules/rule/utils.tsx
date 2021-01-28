import * as Sentry from '@sentry/react';

import {t} from 'app/locale';
import {DynamicSamplingConditionOperator} from 'app/types/dynamicSampling';

export function getOperatorLabel(operator: DynamicSamplingConditionOperator) {
  switch (operator) {
    case DynamicSamplingConditionOperator.GLOB_MATCH:
      return t('Release');
    case DynamicSamplingConditionOperator.EQUAL:
      return t('User');
    case DynamicSamplingConditionOperator.STR_EQUAL_NO_CASE:
      return t('Enviroment');
    default: {
      Sentry.withScope(scope => {
        scope.setLevel(Sentry.Severity.Warning);
        Sentry.captureException(new Error('Unknown dynamic sampling condition operator'));
      });
      return null; //this shall never happen
    }
  }
}
