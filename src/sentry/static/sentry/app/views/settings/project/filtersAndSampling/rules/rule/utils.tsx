import * as Sentry from '@sentry/react';

import {t} from 'app/locale';
import {DynamicSamplingInnerOperator} from 'app/types/dynamicSampling';

export function getInnerOperatorLabel(operator: DynamicSamplingInnerOperator) {
  switch (operator) {
    case DynamicSamplingInnerOperator.GLOB_MATCH:
      return t('Release');
    case DynamicSamplingInnerOperator.EQUAL:
      return t('Enviroment');
    default: {
      Sentry.withScope(scope => {
        scope.setLevel(Sentry.Severity.Warning);
        Sentry.captureException(
          new Error('Unknown dynamic sampling condition inner operator')
        );
      });
      return null; //this shall never happen
    }
  }
}
