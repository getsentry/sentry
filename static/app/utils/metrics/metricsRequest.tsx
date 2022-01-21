import * as React from 'react';
import isEqual from 'lodash/isEqual';
import omitBy from 'lodash/omitBy';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
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
  statsPeriod?: string;
  start?: DateString;
  end?: DateString;
  query?: string;
  groupBy?: string[];
  orderBy?: string;
  limit?: number;
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
    const {project, environment, field, query, groupBy, orderBy, limit, interval} =
      this.props;

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
      limit,
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
    }));

    const promises = [api.requestPromise(this.path, {query: this.baseQueryParams()})];

    if (shouldFetchPreviousPeriod({start, end, period: statsPeriod, includePrevious})) {
      promises.push(
        api.requestPromise(this.path, {
          query: this.baseQueryParams({previousPeriod: true}),
        })
      );
    }

    try {
      const [response, responsePrevious] = (await Promise.all(promises)) as [
        MetricsApiResponse,
        MetricsApiResponse | undefined
      ];

      if (this.unmounting) {
        return;
      }

      this.setState({
        reloading: false,
        response,
        responsePrevious: responsePrevious ?? null,
      });
    } catch (error) {
      addErrorMessage(error.responseJSON?.detail ?? t('Error loading metrics data'));
      this.setState({
        reloading: false,
        errored: true,
        error: error.responseJSON?.detail ?? null,
      });
    }
  };

  render() {
    const {reloading, errored, error, response, responsePrevious} = this.state;
    const {children, isDisabled, includeTabularData} = this.props;

    const loading = response === null && !isDisabled;

    return children?.({
      loading,
      isLoading: loading, // loading alias, some components downstream are used to one or the other (because of EventsRequest vs DiscoverQuery)
      reloading,
      errored,
      error,
      response,
      responsePrevious,
      tableData: includeTabularData
        ? transformMetricsResponseToTable({response})
        : undefined,
    });
  }
}

export default MetricsRequest;
