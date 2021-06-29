import * as React from 'react';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {t} from 'app/locale';
import {Organization, SessionApiResponse} from 'app/types';
import withApi from 'app/utils/withApi';

import {getReleaseParams, ReleaseBounds} from '../../utils';

function omitIgnoredProps(props: Props) {
  // TODO(release-comparison): pick the right props
  return omit(props, ['api', 'organization', 'children', 'location']);
}

export function reduceTimeSeriesGroups(
  acc: number[],
  group: SessionApiResponse['groups'][number],
  field: 'count_unique(user)' | 'sum(session)'
) {
  group.series[field]?.forEach(
    (value, index) => (acc[index] = (acc[index] ?? 0) + value)
  );

  return acc;
}

export type ReleaseHealthRequestRenderProps = {
  loading: boolean;
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
  loading: boolean;
  errored: boolean;
  thisRelease: SessionApiResponse | null;
  allReleases: SessionApiResponse | null;
};

class ReleaseDetailsRequest extends React.Component<Props, State> {
  state: State = {
    loading: false,
    errored: false,
    thisRelease: null,
    allReleases: null,
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
    const {location, releaseBounds} = this.props;

    return {
      field: ['count_unique(user)', 'sum(session)'],
      groupBy: ['session.status'],
      interval: '1h', // TODO(release-comparison): calculatete interval dynamically
      ...getReleaseParams({
        location,
        releaseBounds,
        defaultStatsPeriod: DEFAULT_STATS_PERIOD, // this will be removed once we get rid off legacy release details
        allowEmptyPeriod: true,
      }),
    };
  }

  fetchData = async () => {
    const {api, disable} = this.props;

    if (disable) {
      return;
    }

    api.clear();
    this.setState({
      loading: true,
      errored: false,
    });

    const promises = [this.fetchThisRelease(), this.fetchAllReleases()];

    try {
      const [thisRelease, allReleases] = await Promise.all(promises);

      this.setState({
        loading: false,
        thisRelease,
        allReleases,
      });
    } catch (error) {
      addErrorMessage(error.responseJSON?.detail ?? t('Error loading health data'));
      this.setState({
        loading: false,
        errored: true,
        thisRelease: null,
        allReleases: null,
      });
    }
  };

  async fetchThisRelease() {
    const {api, version} = this.props;

    const response: SessionApiResponse = await api.requestPromise(this.path, {
      query: {
        ...this.baseQueryParams,
        query: `release:${version}`,
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
    const {loading, errored, thisRelease, allReleases} = this.state;
    const {children} = this.props;

    return children({
      loading,
      errored,
      thisRelease,
      allReleases,
    });
  }
}

export default withApi(ReleaseDetailsRequest);
