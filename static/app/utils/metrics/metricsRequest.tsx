import * as React from 'react';
import isEqual from 'lodash/isEqual';
import omitBy from 'lodash/omitBy';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {doMetricsRequest, DoMetricsRequestOptions} from 'sentry/actionCreators/metrics';
import {Client, ResponseMeta} from 'sentry/api';
import {shouldFetchPreviousPeriod} from 'sentry/components/charts/utils';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t} from 'sentry/locale';
import {MetricsApiResponse} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {getPeriod} from 'sentry/utils/getPeriod';

import {TableData} from '../discover/discoverQuery';

import {deprecatedTransformMetricsResponseToTable} from './deprecatedTransformMetricsResponseToTable';
import {transformMetricsResponseToSeries} from './transformMetricsResponseToSeries';

const propNamesToIgnore = ['api', 'children'];
const omitIgnoredProps = (props: Props) =>
  omitBy(props, (_value, key) => propNamesToIgnore.includes(key));

export type MetricsRequestRenderProps = {
  error: string | null;
  errored: boolean;
  isLoading: boolean;
  loading: boolean;
  pageLinks: string | null;
  reloading: boolean;
  response: MetricsApiResponse | null;
  responsePrevious: MetricsApiResponse | null;
  seriesData?: Series[];
  seriesDataPrevious?: Series[];
  tableData?: TableData;
};

type DefaultProps = {
  /**
   * @deprecated
   * Transform the response data to be something ingestible by GridEditable tables and rename fields for performance
   */
  includeDeprecatedTabularData: boolean;
  /**
   * Include data for previous period
   */
  includePrevious: boolean;
  /**
   * Transform the response data to be something ingestible by charts
   */
  includeSeriesData: boolean;
  /**
   * If true, no request will be made
   */
  isDisabled?: boolean;
};

type Props = DefaultProps &
  Omit<
    DoMetricsRequestOptions,
    'includeAllArgs' | 'statsPeriodStart' | 'statsPeriodEnd'
  > & {
    api: Client;
    children?: (renderProps: MetricsRequestRenderProps) => React.ReactNode;
  };

type State = {
  error: string | null;
  errored: boolean;
  pageLinks: string | null;
  reloading: boolean;
  response: MetricsApiResponse | null;
  responsePrevious: MetricsApiResponse | null;
};

class MetricsRequest extends React.Component<Props, State> {
  static defaultProps: DefaultProps = {
    includePrevious: false,
    includeSeriesData: false,
    includeDeprecatedTabularData: false,
    isDisabled: false,
  };

  state: State = {
    reloading: false,
    errored: false,
    error: null,
    response: null,
    responsePrevious: null,
    pageLinks: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    if (isEqual(omitIgnoredProps(prevProps), omitIgnoredProps(this.props))) {
      return;
    }

    this.fetchData();
  }

  componentWillUnmount() {
    this.unmounting = true;
  }

  private unmounting: boolean = false;

  getQueryParams({previousPeriod = false} = {}) {
    const {
      project,
      environment,
      field,
      query,
      groupBy,
      orderBy,
      limit,
      interval,
      cursor,
      statsPeriod,
      start,
      end,
      orgSlug,
    } = this.props;

    const commonQuery = {
      field,
      cursor,
      environment,
      groupBy,
      interval,
      query,
      limit,
      project,
      orderBy,
      orgSlug,
    };

    if (!previousPeriod) {
      return {
        ...commonQuery,
        statsPeriod,
        start,
        end,
      };
    }

    const doubledStatsPeriod = getPeriod(
      {period: statsPeriod, start: undefined, end: undefined},
      {shouldDoublePeriod: true}
    ).statsPeriod;

    return {
      ...commonQuery,
      statsPeriodStart: doubledStatsPeriod,
      statsPeriodEnd: statsPeriod ?? DEFAULT_STATS_PERIOD,
    };
  }

  fetchData = async () => {
    const {api, isDisabled, start, end, statsPeriod, includePrevious} = this.props;

    if (isDisabled) {
      return;
    }

    this.setState(state => ({
      reloading: state.response !== null,
      errored: false,
      error: null,
      pageLinks: null,
    }));

    const promises = [
      doMetricsRequest(api, {includeAllArgs: true, ...this.getQueryParams()}),
    ];

    // TODO(metrics): this could be merged into one request by doubling the statsPeriod and then splitting the response in half
    if (shouldFetchPreviousPeriod({start, end, period: statsPeriod, includePrevious})) {
      promises.push(doMetricsRequest(api, this.getQueryParams({previousPeriod: true})));
    }

    try {
      const [[response, _, responseMeta], responsePrevious] = (await Promise.all(
        promises
      )) as [
        [MetricsApiResponse, string | undefined, ResponseMeta | undefined],
        MetricsApiResponse | undefined
      ];

      if (this.unmounting) {
        return;
      }

      this.setState({
        reloading: false,
        response,
        responsePrevious: responsePrevious ?? null,
        pageLinks: responseMeta?.getResponseHeader('Link') ?? null,
      });
    } catch (error) {
      addErrorMessage(error.responseJSON?.detail ?? t('Error loading metrics data'));
      this.setState({
        reloading: false,
        errored: true,
        error: error.responseJSON?.detail ?? null,
        pageLinks: null,
      });
    }
  };

  render() {
    const {reloading, errored, error, response, responsePrevious, pageLinks} = this.state;
    const {
      children,
      isDisabled,
      includeDeprecatedTabularData,
      includeSeriesData,
      includePrevious,
    } = this.props;

    const loading = response === null && !isDisabled && !error;

    return children?.({
      loading,
      reloading,
      isLoading: loading || reloading, // some components downstream are used to loading/reloading or isLoading that combines both (EventsRequest vs DiscoverQuery)
      errored,
      error,
      response,
      responsePrevious,
      pageLinks,
      tableData: includeDeprecatedTabularData
        ? deprecatedTransformMetricsResponseToTable({response})
        : undefined,
      seriesData: includeSeriesData
        ? transformMetricsResponseToSeries(response)
        : undefined,
      seriesDataPrevious:
        includeSeriesData && includePrevious
          ? transformMetricsResponseToSeries(responsePrevious)
          : undefined,
    });
  }
}

export default MetricsRequest;
