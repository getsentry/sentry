import {useTheme} from '@emotion/react';
import type {Location} from 'history';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import LoadingPanel from 'sentry/components/charts/loadingPanel';
import {IconWarning} from 'sentry/icons';
import type {OrganizationSummary} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {useApiQuery} from 'sentry/utils/queryClient';
import {
  filterToColor,
  SpanOperationBreakdownFilter,
} from 'sentry/views/performance/transactionSummary/filter';
import type {ViewProps} from 'sentry/views/performance/types';

import Chart from './chart';
import {transformData} from './utils';

type ApiResult = Record<string, number>;

interface Props extends ViewProps {
  currentFilter: SpanOperationBreakdownFilter;
  fields: string[];
  location: Location;
  organization: OrganizationSummary;
  queryExtras?: Record<string, string>;
}

/**
 * Fetch and render a bar chart that shows event volume
 * for each duration bucket. We always render 15 buckets of
 * equal widths based on the endpoints min + max durations.
 *
 * This graph visualizes how many transactions were recorded
 * at each duration bucket, showing the modality of the transaction.
 */
function Content({
  currentFilter,
  fields,
  location,
  organization,
  queryExtras,
  start,
  end,
  query,
  statsPeriod,
  environment,
  project,
}: Props) {
  const theme = useTheme();
  const eventView = EventView.fromSavedQuery({
    id: '',
    name: '',
    version: 2,
    fields,
    orderby: '',
    projects: project,
    range: statsPeriod,
    query,
    environment,
    start,
    end,
  });
  let apiPayload = eventView.getEventsAPIPayload(location);
  apiPayload = {
    ...apiPayload,
    ...queryExtras,
    referrer: 'api.insights.durationpercentilechart',
  };

  const {
    data: chartData,
    isPending,
    isError,
  } = useApiQuery<{data: ApiResult[]}>(
    [`/organizations/${organization.slug}/events/`, {query: apiPayload}],
    {
      staleTime: 0,
    }
  );

  if (isError) {
    return (
      <ErrorPanel>
        <IconWarning variant="muted" size="lg" />
      </ErrorPanel>
    );
  }

  if (isPending) {
    return <LoadingPanel data-test-id="histogram-loading" />;
  }

  if (!defined(chartData)) {
    return null;
  }

  const colors = () =>
    currentFilter === SpanOperationBreakdownFilter.NONE
      ? theme.chart.getColorPalette(1)
      : [filterToColor(currentFilter, theme)];

  return <Chart series={transformData(chartData.data, false)} colors={colors} />;
}

export default Content;
