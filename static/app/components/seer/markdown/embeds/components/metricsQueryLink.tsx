import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {IconGraph} from 'sentry/icons';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getMetricsQueryHref, type MetricsQueryData} from './metricsQueryUtils';

/**
 * The name the model gave the query, falling back to the metric's own name. The
 * block renders this as its heading, so both levels name the query the same way.
 */
export function getMetricsQueryTitle(data: MetricsQueryData): string {
  return data.title ?? data.name;
}

export function MetricsQueryLink({data}: {data: MetricsQueryData}) {
  const organization = useOrganization();

  return (
    <ResourceLink
      icon={IconGraph}
      href={getMetricsQueryHref(data, organization)}
      title={getMetricsQueryTitle(data)}
    />
  );
}
