import * as React from 'react';
import isEqual from 'lodash/isEqual';
import omitBy from 'lodash/omitBy';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import {t} from 'app/locale';
import {DateString, Organization, SessionApiResponse, SessionField} from 'app/types';
import {getSessionsInterval} from 'app/utils/sessions';

const propNamesToIgnore = ['api', 'children', 'organization'];
const omitIgnoredProps = (props: Props) =>
  omitBy(props, (_value, key) => propNamesToIgnore.includes(key));

export type SessionsRequestRenderProps = {
  loading: boolean;
  reloading: boolean;
  errored: boolean;
  response: SessionApiResponse | null;
};

type Props = {
  api: Client;
  organization: Organization;
  children: (renderProps: SessionsRequestRenderProps) => React.ReactNode;
  field: SessionField[];
  project?: number[];
  environment?: string[];
  statsPeriod?: string;
  start?: DateString;
  end?: DateString;
  query?: string;
  groupBy?: string[];
  interval?: string;
  disable?: boolean;
};

type State = {
  reloading: boolean;
  errored: boolean;
  response: SessionApiResponse | null;
};

class SessionsRequest extends React.Component<Props, State> {
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
    const {api, disable} = this.props;

    if (disable) {
      return;
    }

    api.clear();
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
        response,
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
