import * as Sentry from '@sentry/react';

import {t} from 'app/locale';
import {DynamicSamplingInnerName} from 'app/types/dynamicSampling';

export function getInnerNameLabel(name: DynamicSamplingInnerName) {
  switch (name) {
    case DynamicSamplingInnerName.TRACE_ENVIRONMENT:
    case DynamicSamplingInnerName.EVENT_ENVIRONMENT:
      return t('Enviroment');
    case DynamicSamplingInnerName.TRACE_RELEASE:
    case DynamicSamplingInnerName.EVENT_RELEASE:
      return t('Release');
    case DynamicSamplingInnerName.EVENT_USER:
    case DynamicSamplingInnerName.TRACE_USER:
      return t('User');
    default: {
      Sentry.withScope(scope => {
        scope.setLevel(Sentry.Severity.Warning);
        Sentry.captureException(
          new Error('Unknown dynamic sampling condition inner name')
        );
      });
      return null; //this shall never happen
    }
  }
}
