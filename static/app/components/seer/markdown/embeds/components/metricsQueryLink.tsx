import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {IconGraph} from 'sentry/icons';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getMetricsQueryHref, type MetricsQueryData} from './metricsQueryUtils';

export function MetricsQueryLink({data}: {data: MetricsQueryData}) {
  const organization = useOrganization();

  return (
    <ResourceLink
      icon={IconGraph}
      href={getMetricsQueryHref(data, organization)}
      title={data.title ?? data.name}
    />
  );
}
