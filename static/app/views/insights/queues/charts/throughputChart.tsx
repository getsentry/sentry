import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {BaseChartActionDropdown} from 'sentry/views/insights/common/components/chartActionDropdown';
// Our loadable chart widgets use this to render, so this import is ok
// eslint-disable-next-line no-restricted-imports
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {useTopNSpanMetricsSeries} from 'sentry/views/insights/common/queries/useTopNDiscoverSeries';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';
import {renameDiscoverSeries} from 'sentry/views/insights/common/utils/renameDiscoverSeries';
import {useAlertsProject} from 'sentry/views/insights/common/utils/useAlertsProject';
import type {Referrer} from 'sentry/views/insights/queues/referrers';
import {FIELD_ALIASES} from 'sentry/views/insights/queues/settings';
import type {SpanQueryFilters} from 'sentry/views/insights/types';
import {SpanFields} from 'sentry/views/insights/types';

interface Props {
  id: string;
  referrer: Referrer;
  destination?: string;
  error?: Error | null;
  pageFilters?: PageFilters;
}

export function ThroughputChart({id, error, destination, pageFilters, referrer}: Props) {
  const theme = useTheme();
  const organization = useOrganization();
  const project = useAlertsProject();
  const {selection} = usePageFilters();

  const search = MutableSearch.fromQueryObject({
    'span.op': '[queue.publish, queue.process]',
  } satisfies SpanQueryFilters);
  const groupBy = SpanFields.SPAN_OP;
  const yAxis = 'epm()';
  const title = t('Published vs Processed');

  if (destination) {
    search.addFilterValue('messaging.destination.name', destination, false);
  }

  const {
    data,
    error: topNError,
    isLoading,
  } = useTopNSpanMetricsSeries(
    {
      search,
      yAxis: [yAxis],
      fields: [yAxis, groupBy],
      topN: 2,
      transformAliasToInputFormat: true,
    },
    referrer,
    pageFilters
  );

  const publishData: DiscoverSeries = data.find(
    (d): d is DiscoverSeries => d.seriesName === 'queue.publish'
  ) ?? {data: [], seriesName: 'queue.publish', meta: {fields: {}, units: {}}};

  const processData: DiscoverSeries = data.find(
    (d): d is DiscoverSeries => d.seriesName === 'queue.process'
  ) ?? {data: [], seriesName: 'queue.process', meta: {fields: {}, units: {}}};

  const colors = theme.chart.getColorPalette(2);

  const exploreUrl = getExploreUrl({
    selection,
    organization,
    visualize: [
      {
        chartType: ChartType.LINE,
        yAxes: [yAxis],
      },
    ],
    mode: Mode.AGGREGATE,
    title,
    query: search?.formatString(),
    sort: undefined,
    groupBy: [groupBy],
    referrer,
  });

  const extraActions = [
    <BaseChartActionDropdown
      key="throughput-chart-action"
      alertMenuOptions={[
        {
          key: 'publish',
          label: FIELD_ALIASES['epm() span.op:queue.publish'],
          to: getAlertsUrl({
            project,
            query: 'span.op:queue.publish',
            dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
            pageFilters: selection,
            aggregate: yAxis,
            organization,
            referrer,
          }),
        },
        {
          key: 'process',
          label: FIELD_ALIASES['epm() span.op:queue.process'],
          to: getAlertsUrl({
            project,
            query: 'span.op:queue.process',
            dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
            pageFilters: selection,
            aggregate: yAxis,
            organization,
            referrer,
          }),
        },
      ]}
      exploreUrl={exploreUrl}
      referrer={referrer}
    />,
  ];

  return (
    <InsightsLineChartWidget
      id={id}
      extraActions={extraActions}
      title={title}
      series={[
        renameDiscoverSeries(
          {
            ...publishData,
            color: colors[1],
          },
          'epm() span.op:queue.publish'
        ),
        renameDiscoverSeries(
          {
            ...processData,
            color: colors[2],
          },
          'epm() span.op:queue.process'
        ),
      ]}
      aliases={FIELD_ALIASES}
      isLoading={isLoading}
      error={error ?? topNError}
    />
  );
}
