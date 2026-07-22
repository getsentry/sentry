import {useQuery} from '@tanstack/react-query';

import {InfoTip} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {KeyValueData} from 'sentry/components/keyValueData';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import {formatEstimatedCostUsd} from './utils';

interface LowValueSpanEstimatedCostProps {
  /**
   * The projected (already-extrapolated) 30-day span volume the cost is
   * estimated from. The endpoint applies no further extrapolation.
   */
  extrapolatedSpanCount: number;
}

// The rate the estimate was priced at, which tailors the tooltip copy.
type PricingBasis = 'fixed_rate' | 'payg' | 'reserved';

interface LowValueSpanCostsResponse {
  estimatedCostUsd: number | null;
  pricingBasis: PricingBasis | null;
}

function getEstimatedCostTooltip(pricingBasis: PricingBasis | null): string {
  switch (pricingBasis) {
    case 'payg':
      return t(
        'Projected 30-day cost at your pay-as-you-go rate, based on a recent sample. Actual cost may differ.'
      );
    case 'reserved':
      return t(
        'Projected 30-day cost at your reserved rate, based on a recent sample. Actual cost may differ.'
      );
    default:
      return t('Projected 30-day cost based on a recent sample. Actual cost may differ.');
  }
}

/**
 * Fetches and renders the estimated cost row for a low-value span issue. The
 * caller gates this behind billing access and a known span volume, so the
 * request always runs while the component is mounted and the row is always
 * rendered (as a skeleton, an error, or the value).
 */
export function LowValueSpanEstimatedCost({
  extrapolatedSpanCount,
}: LowValueSpanEstimatedCostProps) {
  const organization = useOrganization();
  const costQuery = useQuery(
    apiOptions.as<LowValueSpanCostsResponse>()(
      '/organizations/$organizationIdOrSlug/low-value-spans-costs/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {spanCount: extrapolatedSpanCount},
        staleTime: 30_000,
      }
    )
  );

  let value: React.ReactNode;
  if (costQuery.isPending) {
    value = <Placeholder height="1rem" width="80px" />;
  } else if (costQuery.isError) {
    value = <Text variant="danger">{t('Unable to load estimate')}</Text>;
  } else {
    value = (
      <Flex align="center" gap="xs">
        <Text monospace>{formatEstimatedCostUsd(costQuery.data.estimatedCostUsd)}</Text>
        <InfoTip size="xs" title={getEstimatedCostTooltip(costQuery.data.pricingBasis)} />
      </Flex>
    );
  }

  return (
    <KeyValueData.Content
      disableFormattedData
      item={{key: 'estimated-cost', subject: t('Estimated cost'), value}}
    />
  );
}
