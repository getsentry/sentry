import {Location} from 'history';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';

import AsyncComponent from 'sentry/components/asyncComponent';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import LoadingPanel from 'sentry/components/charts/loadingPanel';
import {IconWarning} from 'sentry/icons';
import {OrganizationSummary} from 'sentry/types';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {Theme} from 'sentry/utils/theme';

import {ViewProps} from '../../../types';
import {QUERY_KEYS} from '../../../utils';
import {filterToColor, SpanOperationBreakdownFilter} from '../../filter';

import Chart from './chart';
import {transformData} from './utils';

type ApiResult = Record<string, number>;

type Props = AsyncComponent['props'] &
  ViewProps & {
    currentFilter: SpanOperationBreakdownFilter;
    fields: string[];
    location: Location;
    organization: OrganizationSummary;
  };

type State = AsyncComponent['state'] & {
  chartData: {data: ApiResult[]} | null;
};

/**
 * Fetch and render a bar chart that shows event volume
 * for each duration bucket. We always render 15 buckets of
 * equal widths based on the endpoints min + max durations.
 *
 * This graph visualizes how many transactions were recorded
 * at each duration bucket, showing the modality of the transaction.
 */
class Content extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {
      organization,
      query,
      start,
      end,
      statsPeriod,
      environment,
      project,
      fields,
      location,
    } = this.props;

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
    const apiPayload = eventView.getEventsAPIPayload(location);
    apiPayload.referrer = 'api.performance.durationpercentilechart';
    const endpoint = organization.features.includes(
      'performance-frontend-use-events-endpoint'
    )
      ? `/organizations/${organization.slug}/events/`
      : `/organizations/${organization.slug}/eventsv2/`;

    return [['chartData', endpoint, {query: apiPayload}]];
  }

  componentDidUpdate(prevProps: Props) {
    if (this.shouldRefetchData(prevProps)) {
      this.fetchData();
    }
  }

  shouldRefetchData(prevProps: Props) {
    if (this.state.loading) {
      return false;
    }
    return !isEqual(pick(prevProps, QUERY_KEYS), pick(this.props, QUERY_KEYS));
  }

  renderLoading() {
    return <LoadingPanel data-test-id="histogram-loading" />;
  }

  renderError() {
    // Don't call super as we don't really need issues for this.
    return (
      <ErrorPanel>
        <IconWarning color="gray300" size="lg" />
      </ErrorPanel>
    );
  }

  renderBody() {
    const {currentFilter, organization} = this.props;
    const {chartData} = this.state;

    if (!defined(chartData)) {
      return null;
    }

    const colors = (theme: Theme) =>
      currentFilter === SpanOperationBreakdownFilter.None
        ? theme.charts.getColorPalette(1)
        : [filterToColor(currentFilter)];

    return (
      <Chart
        series={transformData(
          chartData.data,
          !organization.features.includes('performance-frontend-use-events-endpoint')
        )}
        colors={colors}
      />
    );
  }
}

export default Content;
