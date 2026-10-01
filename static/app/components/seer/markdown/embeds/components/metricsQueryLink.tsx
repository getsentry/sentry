import {
  ResourceLink,
  type ResourceLinkFormatProps,
} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
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

export function MetricsQueryLink({
  data,
  format,
}: {data: MetricsQueryData} & ResourceLinkFormatProps) {
  const organization = useOrganization();

  return (
    <ResourceLink
      format={format}
      icon={IconGraph}
      href={getMetricsQueryHref(data, organization)}
      title={getMetricsQueryTitle(data)}
    />
  );
}
