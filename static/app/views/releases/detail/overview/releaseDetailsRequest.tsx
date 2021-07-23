import * as React from 'react';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {t} from 'app/locale';
import {Organization, SessionApiResponse} from 'app/types';
import {filterSessionsInTimeWindow, getSessionsInterval} from 'app/utils/sessions';
import withApi from 'app/utils/withApi';

import {getReleaseParams, ReleaseBounds} from '../../utils';

export type ReleaseHealthRequestRenderProps = {
  loading: boolean;
  reloading: boolean;
  errored: boolean;
  thisRelease: SessionApiResponse | null;
  allReleases: SessionApiResponse | null;
};

type Props = {
  api: Client;
  organization: Organization;
  children: (renderProps: ReleaseHealthRequestRenderProps) => React.ReactNode;
  location: Location;
  version: string;
  releaseBounds: ReleaseBounds;
  disable?: boolean;
};

type State = {
  reloading: boolean;
  errored: boolean;
  thisRelease: SessionApiResponse | null;
  allReleases: SessionApiResponse | null;
};

class ReleaseDetailsRequest extends React.Component<Props, State> {
  state: State = {
    reloading: false,
    errored: false,
    thisRelease: null,
    allReleases: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    if (
      prevProps.version !== this.props.version ||
      !isEqual(prevProps.location, this.props.location)
    ) {
      this.fetchData();
    }
  }

  get path() {
    const {organization} = this.props;

    return `/organizations/${organization.slug}/sessions/`;
  }

  get baseQueryParams() {
    const {location, releaseBounds, organization} = this.props;

    const releaseParams = getReleaseParams({
      location,
      releaseBounds,
      defaultStatsPeriod: DEFAULT_STATS_PERIOD, // this will be removed once we get rid off legacy release details
      allowEmptyPeriod: true,
    });

    return {
      field: ['count_unique(user)', 'sum(session)'],
      groupBy: ['session.status'],
      interval: getSessionsInterval(
        {
          start: releaseParams.start,
          end: releaseParams.end,
          period: releaseParams.statsPeriod ?? undefined,
        },
        {highFidelity: organization.features.includes('minute-resolution-sessions')}
      ),
      ...releaseParams,
    };
  }

  fetchData = async () => {
    const {api, disable} = this.props;

    if (disable) {
      return;
    }

    api.clear();
    this.setState(state => ({
      reloading: state.thisRelease !== null && state.allReleases !== null,
      errored: false,
    }));

    const promises = [this.fetchThisRelease(), this.fetchAllReleases()];

    try {
      const [thisRelease, allReleases] = await Promise.all(promises);

      this.setState({
        reloading: false,
        thisRelease: filterSessionsInTimeWindow(
          thisRelease,
          this.baseQueryParams.start,
          this.baseQueryParams.end
        ),
        allReleases: filterSessionsInTimeWindow(
          allReleases,
          this.baseQueryParams.start,
          this.baseQueryParams.end
        ),
      });
    } catch (error) {
      addErrorMessage(error.responseJSON?.detail ?? t('Error loading health data'));
      this.setState({
        reloading: false,
        errored: true,
      });
    }
  };

  async fetchThisRelease() {
    const {api, version} = this.props;

    const response: SessionApiResponse = await api.requestPromise(this.path, {
      query: {
        ...this.baseQueryParams,
        query: `release:"${version}"`,
      },
    });

    return response;
  }

  async fetchAllReleases() {
    const {api} = this.props;

    const response: SessionApiResponse = await api.requestPromise(this.path, {
      query: this.baseQueryParams,
    });

    return response;
  }

  render() {
    const {reloading, errored, thisRelease, allReleases} = this.state;
    const {children} = this.props;

    const loading = thisRelease === null && allReleases === null;

    return children({
      loading,
      reloading,
      errored,
      thisRelease,
      allReleases,
    });
  }
}

export default withApi(ReleaseDetailsRequest);
