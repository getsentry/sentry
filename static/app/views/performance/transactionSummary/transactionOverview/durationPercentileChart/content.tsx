import type {Theme} from '@emotion/react';
import type {Location} from 'history';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import LoadingPanel from 'sentry/components/charts/loadingPanel';
import {IconWarning} from 'sentry/icons';
import type {OrganizationSummary} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {useApiQuery} from 'sentry/utils/queryClient';

import type {ViewProps} from '../../../types';
import {filterToColor, SpanOperationBreakdownFilter} from '../../filter';

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
    referrer: 'api.performance.durationpercentilechart',
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
        <IconWarning color="gray300" size="lg" />
      </ErrorPanel>
    );
  }

  if (isPending) {
    return <LoadingPanel data-test-id="histogram-loading" />;
  }

  if (!defined(chartData)) {
    return null;
  }

  const colors = (theme: Theme) =>
    currentFilter === SpanOperationBreakdownFilter.NONE
      ? (theme.charts.getColorPalette(1) as string[] | undefined) ?? []
      : [filterToColor(currentFilter)];

  return <Chart series={transformData(chartData.data, false)} colors={colors} />;
}

export default Content;
