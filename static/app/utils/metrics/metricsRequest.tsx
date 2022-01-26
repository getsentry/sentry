import * as React from 'react';
import isEqual from 'lodash/isEqual';
import omitBy from 'lodash/omitBy';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client, ResponseMeta} from 'sentry/api';
import {getInterval, shouldFetchPreviousPeriod} from 'sentry/components/charts/utils';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t} from 'sentry/locale';
import {DateString, MetricsApiResponse, Organization} from 'sentry/types';
import {getPeriod} from 'sentry/utils/getPeriod';

import {TableData} from '../discover/discoverQuery';

import {getMetricsDataSource} from './getMetricsDataSource';
import {transformMetricsResponseToTable} from './transformMetricsResponseToTable';

const propNamesToIgnore = ['api', 'children'];
const omitIgnoredProps = (props: Props) =>
  omitBy(props, (_value, key) => propNamesToIgnore.includes(key));

export type MetricsRequestRenderProps = {
  loading: boolean;
  isLoading: boolean;
  reloading: boolean;
  errored: boolean;
  error: string | null;
  response: MetricsApiResponse | null;
  responsePrevious: MetricsApiResponse | null;
  pageLinks: string | null;
  tableData?: TableData;
};

type DefaultProps = {
  /**
   * Include data for previous period
   */
  includePrevious: boolean;
};

type Props = DefaultProps & {
  api: Client;
  orgSlug: Organization['slug'];
  field: string[];
  children?: (renderProps: MetricsRequestRenderProps) => React.ReactNode;
  project?: Readonly<number[]>;
  environment?: Readonly<string[]>;
  statsPeriod?: string | null;
  start?: DateString;
  end?: DateString;
  query?: string;
  groupBy?: string[];
  orderBy?: string;
  limit?: number;
  cursor?: string;
  interval?: string;
  isDisabled?: boolean;
  /**
   * Transform the response data to be something ingestible by GridEditable tables
   */
  includeTabularData?: boolean;
};

type State = {
  reloading: boolean;
  errored: boolean;
  error: string | null;
  response: MetricsApiResponse | null;
  responsePrevious: MetricsApiResponse | null;
  pageLinks: string | null;
};

class MetricsRequest extends React.Component<Props, State> {
  static defaultProps: DefaultProps = {
    includePrevious: false,
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

  get path() {
    const {orgSlug} = this.props;

    return `/organizations/${orgSlug}/metrics/data/`;
  }

  baseQueryParams({previousPeriod = false} = {}) {
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
    } = this.props;

    const {start, end, statsPeriod} = getPeriod({
      period: this.props.statsPeriod,
      start: this.props.start,
      end: this.props.end,
    });

    const commonQuery = {
      project,
      environment,
      field,
      query: query || undefined,
      groupBy,
      orderBy,
      per_page: limit,
      cursor,
      interval: interval ? interval : getInterval({start, end, period: statsPeriod}),
      datasource: getMetricsDataSource(),
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
      api.requestPromise(this.path, {
        includeAllArgs: true,
        query: this.baseQueryParams(),
      }),
    ];

    if (shouldFetchPreviousPeriod({start, end, period: statsPeriod, includePrevious})) {
      promises.push(
        api.requestPromise(this.path, {
          query: this.baseQueryParams({previousPeriod: true}),
        })
      );
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
    const {children, isDisabled, includeTabularData} = this.props;

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
      tableData: includeTabularData
        ? transformMetricsResponseToTable({response})
        : undefined,
    });
  }
}

export default MetricsRequest;
