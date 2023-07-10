import {Theme} from '@emotion/react';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import LoadingPanel from 'sentry/components/charts/loadingPanel';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import {IconWarning} from 'sentry/icons';
import {OrganizationSummary} from 'sentry/types';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';

import {ViewProps} from '../../../types';
import {QUERY_KEYS} from '../../../utils';
import {filterToColor, SpanOperationBreakdownFilter} from '../../filter';

import Chart from './chart';
import {transformData} from './utils';

type ApiResult = Record<string, number>;

type Props = DeprecatedAsyncComponent['props'] &
  ViewProps & {
    currentFilter: SpanOperationBreakdownFilter;
    fields: string[];
    location: Location;
    organization: OrganizationSummary;
    queryExtras?: Record<string, string>;
  };

type State = DeprecatedAsyncComponent['state'] & {
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
class Content extends DeprecatedAsyncComponent<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
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
      queryExtras,
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
    let apiPayload = eventView.getEventsAPIPayload(location);
    apiPayload = {
      ...apiPayload,
      ...queryExtras,
      referrer: 'api.performance.durationpercentilechart',
    };
    const endpoint = `/organizations/${organization.slug}/events/`;

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
    const {currentFilter} = this.props;
    const {chartData} = this.state;

    if (!defined(chartData)) {
      return null;
    }

    const colors = (theme: Theme) =>
      currentFilter === SpanOperationBreakdownFilter.NONE
        ? theme.charts.getColorPalette(1)
        : [filterToColor(currentFilter)];

    return <Chart series={transformData(chartData.data, false)} colors={colors} />;
  }
}

export default Content;
