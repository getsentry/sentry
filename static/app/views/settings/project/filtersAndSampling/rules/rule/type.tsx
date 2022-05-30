import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {t} from 'sentry/locale';
import {DynamicSamplingRuleType} from 'sentry/types/dynamicSampling';

type Props = {
  type: DynamicSamplingRuleType;
};

function Type({type}: Props) {
  switch (type) {
    case DynamicSamplingRuleType.TRANSACTION:
      return <TransactionLabel>{t('Individual transactions')}</TransactionLabel>;
    case DynamicSamplingRuleType.TRACE:
      return <TransactionLabel>{t('Transaction traces')}</TransactionLabel>;
    default: {
      Sentry.captureException(new Error('Unknown dynamic sampling rule type'));
      return null; // this shall never happen
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
