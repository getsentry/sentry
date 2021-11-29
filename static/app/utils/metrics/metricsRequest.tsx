import * as React from 'react';
import isEqual from 'lodash/isEqual';
import omitBy from 'lodash/omitBy';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {getInterval} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {DateString, MetricsApiResponse, Organization} from 'sentry/types';

const propNamesToIgnore = ['api', 'children'];
const omitIgnoredProps = (props: Props) =>
  omitBy(props, (_value, key) => propNamesToIgnore.includes(key));

export type MetricsRequestRenderProps = {
  loading: boolean;
  reloading: boolean;
  errored: boolean;
  response: MetricsApiResponse | null;
};

type Props = {
  api: Client;
  organization: Organization;
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
};

type State = {
  reloading: boolean;
  errored: boolean;
  response: MetricsApiResponse | null;
};

class MetricsRequest extends React.Component<Props, State> {
  state: State = {
    reloading: false,
    errored: false,
    response: null,
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
    const {organization} = this.props;

    return `/organizations/${organization.slug}/metrics/data/`;
  }

  get baseQueryParams() {
    const {
      project,
      environment,
      field,
      statsPeriod,
      start,
      end,
      query,
      groupBy,
      orderBy,
      limit,
      interval,
    } = this.props;

    return {
      project,
      environment,
      field,
      statsPeriod,
      query,
      groupBy,
      orderBy,
      limit,
      start,
      end,
      interval: interval ? interval : getInterval({start, end, period: statsPeriod}),
    };
  }

  fetchData = async () => {
    const {api, isDisabled} = this.props;

    if (isDisabled) {
      return;
    }

    this.setState(state => ({
      reloading: state.response !== null,
      errored: false,
    }));

    try {
      const response: MetricsApiResponse = await api.requestPromise(this.path, {
        query: this.baseQueryParams,
      });

      if (this.unmounting) {
        return;
      }

      this.setState({
        reloading: false,
        response,
      });
    } catch (error) {
      addErrorMessage(error.responseJSON?.detail ?? t('Error loading metrics data'));
      this.setState({
        reloading: false,
        errored: true,
      });
    }
  };

  render() {
    const {reloading, errored, response} = this.state;
    const {children} = this.props;

    const loading = response === null;

    return children?.({
      loading,
      reloading,
      errored,
      response,
    });
  }
}

export default MetricsRequest;
