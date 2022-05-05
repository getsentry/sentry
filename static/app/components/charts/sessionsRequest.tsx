import {Component} from 'react';
import isEqual from 'lodash/isEqual';
import omitBy from 'lodash/omitBy';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {Organization, SessionApiResponse, SessionFieldWithOperation} from 'sentry/types';
import {filterSessionsInTimeWindow, getSessionsInterval} from 'sentry/utils/sessions';

const propNamesToIgnore = ['api', 'children', 'organization'];
const omitIgnoredProps = (props: Props) =>
  omitBy(props, (_value, key) => propNamesToIgnore.includes(key));

export type SessionsRequestRenderProps = {
  errored: boolean;
  loading: boolean;
  reloading: boolean;
  response: SessionApiResponse | null;
};

type Props = {
  api: Client;
  children: (renderProps: SessionsRequestRenderProps) => React.ReactNode;
  field: SessionFieldWithOperation[];
  organization: Organization;
  end?: string;
  environment?: string[];
  groupBy?: string[];
  interval?: string;
  isDisabled?: boolean;
  project?: number[];
  query?: string;
  shouldFilterSessionsInTimeWindow?: boolean;
  start?: string;
  statsPeriod?: string | null;
};

type State = {
  errored: boolean;
  reloading: boolean;
  response: SessionApiResponse | null;
};

class SessionsRequest extends Component<Props, State> {
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

  get path() {
    const {organization} = this.props;

    return `/organizations/${organization.slug}/sessions/`;
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
      interval,
      organization,
    } = this.props;

    return {
      project,
      environment,
      field,
      statsPeriod,
      query,
      groupBy,
      start,
      end,
      interval: interval
        ? interval
        : getSessionsInterval(
            {start, end, period: statsPeriod},
            {highFidelity: organization.features.includes('minute-resolution-sessions')}
          ),
    };
  }

  fetchData = async () => {
    const {api, isDisabled, shouldFilterSessionsInTimeWindow} = this.props;

    if (isDisabled) {
      return;
    }

    this.setState(state => ({
      reloading: state.response !== null,
      errored: false,
    }));

    try {
      const response: SessionApiResponse = await api.requestPromise(this.path, {
        query: this.baseQueryParams,
      });

      this.setState({
        reloading: false,
        response: shouldFilterSessionsInTimeWindow
          ? filterSessionsInTimeWindow(
              response,
              this.baseQueryParams.start,
              this.baseQueryParams.end
            )
          : response,
      });
    } catch (error) {
      addErrorMessage(error.responseJSON?.detail ?? t('Error loading health data'));
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

    return children({
      loading,
      reloading,
      errored,
      response,
    });
  }
}

export default SessionsRequest;
