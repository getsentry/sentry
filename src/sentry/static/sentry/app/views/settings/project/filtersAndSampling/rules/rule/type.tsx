import React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {t} from 'app/locale';
import {DynamicSamplingRuleType} from 'app/types/dynamicSampling';

type Props = {
  type: DynamicSamplingRuleType;
};

function Type({type}: Props) {
  switch (type) {
    case DynamicSamplingRuleType.ERROR:
      return <ErrorLabel>{t('Errors only')}</ErrorLabel>;
    case DynamicSamplingRuleType.TRANSACTION:
      return <TransactionLabel>{t('Individual transactions')}</TransactionLabel>;
    case DynamicSamplingRuleType.TRACE:
      return <TransactionLabel>{t('Transaction traces')}</TransactionLabel>;
    default: {
      Sentry.withScope(scope => {
        scope.setLevel(Sentry.Severity.Warning);
        Sentry.captureException(new Error('Unknown dynamic sampling rule type'));
      });
      return null; //this shall never happen
    }
  }
}

export default Type;

const ErrorLabel = styled('div')`
  color: ${p => p.theme.pink300};
  white-space: pre-wrap;
`;

const TransactionLabel = styled(ErrorLabel)`
  color: ${p => p.theme.linkColor};
`;
