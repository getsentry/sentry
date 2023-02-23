import {Fragment} from 'react';
import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
import Placeholder from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {QueryError} from 'sentry/utils/discover/genericDiscoverQuery';
import {formatFloat, formatPercentage} from 'sentry/utils/formatters';
import {SidebarSpacer} from 'sentry/views/performance/transactionSummary/utils';

interface TransactionPercentageProps {
  error: QueryError | null;
  isLoading: boolean;
  organization: Organization;
  totals: Record<string, number> | null;
  unfilteredTotals?: Record<string, number> | null;
}

export function TransactionPercentage({
  organization,
  isLoading,
  error,
  totals,
  unfilteredTotals,
}: TransactionPercentageProps) {
  const showTPMAsPercentage = organization.features.includes(
    'performance-metrics-backed-transaction-summary'
  );

  function getValueFromTotals(field, totalValues, unfilteredTotalValues) {
    if (totalValues) {
      if (unfilteredTotalValues) {
        return tct('[tpm]', {
          tpm: formatPercentage(totalValues[field] / unfilteredTotalValues[field]),
        });
      }
      return tct('[tpm] tpm', {
        tpm: formatFloat(totalValues[field], 4),
      });
    }
    return null;
  }

  return (
    <Fragment>
      <SectionHeading>
        {showTPMAsPercentage ? t('Percentage of Total Transactions') : t('TPM')}
      </SectionHeading>
      <SectionSummaryValue
        data-test-id="tpm-summary-value"
        isLoading={isLoading}
        error={error}
        value={getValueFromTotals('tpm()', totals, unfilteredTotals)}
      />
      <SidebarSpacer />
    </Fragment>
  );
}

type SectionSummaryValueProps = {
  'data-test-id': string;
  error: QueryError | null;
  isLoading: boolean;
  value: React.ReactNode;
};

function SectionSummaryValue({
  error,
  isLoading,
  value,
  ...props
}: SectionSummaryValueProps) {
  if (error) {
    return <div {...props}>{'\u2014'}</div>;
  }

  if (isLoading) {
    return <Placeholder height="24px" {...props} />;
  }

  return <SectionValue {...props}>{value}</SectionValue>;
}

const SectionValue = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;
