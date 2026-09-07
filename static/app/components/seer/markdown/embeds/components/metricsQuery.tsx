import * as qs from 'query-string';

import {
  toAggregateFields,
  toPageFilters,
} from 'sentry/components/seer/markdown/embeds/components/queryEmbedParams';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {IconGraph} from 'sentry/icons';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeMetricsPathname} from 'sentry/views/explore/metrics/utils';

/**
 * Metrics refuses to decode a query that charts nothing, so fall back to the
 * same aggregate the metrics UI opens with.
 */
const DEFAULT_Y_AXES = ['sum(value)'];

function MetricsQueryLink(props: EmbedOutput<'metricsQuery'>) {
  const organization = useOrganization();
  const {name, type, unit, query, mode, sort, groupBy, yAxes, title} = props;
  const {projects, environments, datetime} = toPageFilters(props);

  const metric = JSON.stringify({
    metric: {name, type, unit},
    query,
    aggregateFields: toAggregateFields({
      groupBy,
      yAxes: yAxes?.length ? yAxes : DEFAULT_Y_AXES,
    }),
    aggregateSortBys: sort ? [sort] : undefined,
    mode,
  });

  const href = `${makeMetricsPathname({organizationSlug: organization.slug, path: '/'})}?${qs.stringify(
    {
      project: projects.length === 0 ? '' : projects,
      environment: environments,
      statsPeriod: datetime.period,
      start: datetime.start,
      end: datetime.end,
      metric,
    },
    {skipNull: true}
  )}`;

  return <ResourceLink icon={IconGraph} href={href} title={title ?? name} />;
}

export const MetricsQuery = defineSeerEmbed({
  name: 'metricsQuery',
  render(props) {
    return <MetricsQueryLink {...props} />;
  },
});
