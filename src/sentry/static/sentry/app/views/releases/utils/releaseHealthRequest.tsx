import React from 'react';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import moment from 'moment';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import {
  DateTimeObject,
  getDiffInMinutes,
  ONE_WEEK,
  TWENTY_FOUR_HOURS,
  TWO_WEEKS,
} from 'app/components/charts/utils';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {t} from 'app/locale';
import {GlobalSelection, Organization, SessionApiResponse} from 'app/types';
import {defined, percent} from 'app/utils';
import {QueryResults, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import withApi from 'app/utils/withApi';

import {DisplayOption} from '../list/utils';

import {getCrashFreePercent} from '.';

const omitIgnoredProps = (props: Props) =>
  omit(props, ['api', 'organization', 'children', 'selection.datetime.utc', 'location']);

function getInterval(datetimeObj: DateTimeObject) {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  if (diffInMinutes >= TWO_WEEKS) {
    return '1d';
  }
  if (diffInMinutes >= ONE_WEEK) {
    return '6h';
  }

  if (diffInMinutes > TWENTY_FOUR_HOURS) {
    return '4h';
  }

  // TODO(sessions): sub-hour session resolution is still not possible
  return '1h';
}

export type ReleaseHealthRequestRenderProps = {
  isHealthLoading: boolean;
  errored: boolean;
  getHealthData: ReturnType<ReleaseHealthRequest['getHealthData']>;
};

type Props = {
  api: Client;
  releases: string[];
  organization: Organization;
  children: (renderProps: ReleaseHealthRequestRenderProps) => React.ReactNode;
  selection: GlobalSelection;
  location: Location;
  display: DisplayOption[];
  defaultStatsPeriod?: string;
};
type State = {
  loading: boolean;
  errored: boolean;
  statusCountByReleaseInPeriod: SessionApiResponse | null;
  totalCountByReleaseIn24h: SessionApiResponse | null;
  totalCountByProjectIn24h: SessionApiResponse | null;
};

class ReleaseHealthRequest extends React.Component<Props, State> {
  state: State = {
    loading: false,
    errored: false,
    statusCountByReleaseInPeriod: null,
    totalCountByReleaseIn24h: null,
    totalCountByProjectIn24h: null,
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
    const {location, selection, defaultStatsPeriod, releases} = this.props;

    return {
      query: stringifyQueryObject(
        new QueryResults(
          releases.reduce((acc, release, index, allReleases) => {
            acc.push(`release:"${release}"`);
            if (index < allReleases.length - 1) {
              acc.push('OR');
            }

            return acc;
          }, [] as string[])
        )
      ),
      interval: getInterval(selection.datetime),
      ...getParams(pick(location.query, Object.values(URL_PARAM)), {
        defaultStatsPeriod,
      }),
    };
  }

  fetchData = async () => {
    const {api} = this.props;

    api.clear();
    this.setState({
      loading: true,
      errored: false,
      statusCountByReleaseInPeriod: null,
      totalCountByReleaseIn24h: null,
      totalCountByProjectIn24h: null,
    });

    try {
      const [
        statusCountByReleaseInPeriod,
        totalCountByReleaseIn24h,
        totalCountByProjectIn24h,
      ] = await Promise.all([
        this.fetchStatusCountByReleaseInPeriod(),
        this.fetchTotalCountByReleaseIn24h(),
        this.fetchTotalCountByProjectIn24h(),
      ]);

      this.setState({
        loading: false,
        statusCountByReleaseInPeriod,
        totalCountByReleaseIn24h,
        totalCountByProjectIn24h,
        // statusCountByReleaseInPeriod: {groups: [], intervals: [], query: ''},
        // totalCountByReleaseIn24h: {groups: [], intervals: [], query: ''},
        // totalCountByProjectIn24h: {groups: [], intervals: [], query: ''},
      });
    } catch (error) {
      addErrorMessage(error.responseJSON?.detail ?? t('Error loading health data'));
      this.setState({
        loading: false,
        errored: true,
      });
    }
  };

  // ?query=release%3Ae2da495e7f7d9f6ac3ff271cf06698032ee8f65d+OR+release%3Aec1fa0d40afdf5539f80846022c385bea0d06b40&interval=1h&statsPeriod=14d&project=11276&environment=prod&field=sum(session)&groupBy=project&groupBy=release&groupBy=session.status
  async fetchStatusCountByReleaseInPeriod() {
    const {api, display} = this.props;

    const response: SessionApiResponse = await api.requestPromise(this.path, {
      query: {
        ...this.baseQueryParams,
        field: [
          ...new Set([...display.map(d => this.displayToField(d)), 'sum(session)']),
        ], // this request needs to be fired for sessions in both display options, (removing potential sum(session) duplicated with Set)
        groupBy: ['project', 'release', 'session.status'],
      },
    });

    return response;
  }

  // ?query=release%3Ae2da495e7f7d9f6ac3ff271cf06698032ee8f65d+OR+release%3Aec1fa0d40afdf5539f80846022c385bea0d06b40&interval=1h&statsPeriod=24h&project=11276&environment=prod&field=sum(session)&groupBy=project&groupBy=release
  async fetchTotalCountByReleaseIn24h() {
    const {api, display} = this.props;

    const response: SessionApiResponse = await api.requestPromise(this.path, {
      query: {
        ...this.baseQueryParams,
        field: display.map(d => this.displayToField(d)),
        groupBy: ['project', 'release'],
        interval: '1h',
        statsPeriod: '24h',
      },
    });

    return response;
  }

  // ?query=&interval=1h&statsPeriod=24h&project=11276&environment=prod&field=sum(session)&groupBy=project
  async fetchTotalCountByProjectIn24h() {
    const {api, display} = this.props;

    const response: SessionApiResponse = await api.requestPromise(this.path, {
      query: {
        ...this.baseQueryParams,
        query: undefined,
        field: display.map(d => this.displayToField(d)),
        groupBy: ['project'],
        interval: '1h',
        statsPeriod: '24h',
      },
    });

    return response;
  }

  displayToField(display: DisplayOption) {
    switch (display) {
      case DisplayOption.USERS:
        return 'count_unique(user)';
      case DisplayOption.SESSIONS:
      default:
        return 'sum(session)';
    }
  }

  getHealthData = () => {
    // TODO(sessions): investigate if this needs to be optimized to lower O(n) complexity
    return {
      getCrashCount: this.getCrashCount,
      getCrashFreeRate: this.getCrashFreeRate,
      get24hCountByRelease: this.get24hCountByRelease,
      get24hCountByProject: this.get24hCountByProject,
      getTimeSeries: this.getTimeSeries,
      getAdoption: this.getAdoption,
    };
  };

  getCrashCount = (version: string, project: number, display: DisplayOption) => {
    const {statusCountByReleaseInPeriod} = this.state;
    const field = this.displayToField(display);

    return statusCountByReleaseInPeriod?.groups.find(
      ({by}) =>
        by.release === version &&
        by.project === project &&
        by['session.status'] === 'crashed'
    )?.totals[field];
  };

  getCrashFreeRate = (version: string, project: number, display: DisplayOption) => {
    const {statusCountByReleaseInPeriod} = this.state;
    const field = this.displayToField(display);

    const totalCount = statusCountByReleaseInPeriod?.groups
      .filter(({by}) => by.release === version && by.project === project)
      ?.reduce((acc, group) => acc + group.totals[field], 0);

    const crashedCount = this.getCrashCount(version, project, display);

    return !defined(totalCount) || totalCount === 0
      ? null
      : getCrashFreePercent(100 - percent(crashedCount ?? 0, totalCount ?? 0));
  };

  get24hCountByRelease = (version: string, project: number, display: DisplayOption) => {
    const {totalCountByReleaseIn24h} = this.state;
    const field = this.displayToField(display);

    return totalCountByReleaseIn24h?.groups
      .filter(({by}) => by.release === version && by.project === project)
      ?.reduce((acc, group) => acc + group.totals[field], 0);
  };

  get24hCountByProject = (project: number, display: DisplayOption) => {
    const {totalCountByProjectIn24h} = this.state;
    const field = this.displayToField(display);

    return totalCountByProjectIn24h?.groups
      .filter(({by}) => by.project === project)
      ?.reduce((acc, group) => acc + group.totals[field], 0);
  };

  getTimeSeries = (
    version: string,
    project: number,
    display: DisplayOption,
    healthStatsPeriod?: string
  ) => {
    if (healthStatsPeriod === 'auto') {
      return this.getPeriodTimeSeries(version, project, display);
    }

    return this.get24hTimeSeries(version, project, display);
  };

  get24hTimeSeries = (version: string, project: number, display: DisplayOption) => {
    const {totalCountByReleaseIn24h} = this.state;
    const field = this.displayToField(display);

    return [
      {
        seriesName: t('This Release'),
        data:
          totalCountByReleaseIn24h?.groups
            .find(({by}) => by.project === project && by.release === version)
            ?.series[field]?.map((value, index) => ({
              name: moment(totalCountByReleaseIn24h.intervals[index]).valueOf(),
              value,
            })) ?? [],
      },
    ];
  };

  getPeriodTimeSeries = (version: string, project: number, display: DisplayOption) => {
    const {statusCountByReleaseInPeriod} = this.state;
    const field = this.displayToField(display);
    return [
      {
        seriesName: t('This Release'),
        data:
          statusCountByReleaseInPeriod?.groups
            .filter(({by}) => by.project === project && by.release === version)
            ?.reduce((acc, group) => {
              group.series[field].forEach(
                (value, index) => (acc[index] = (acc[index] ?? 0) + value)
              );
              return acc;
            }, [] as number[])
            .map((value, index) => ({
              name: moment(statusCountByReleaseInPeriod.intervals[index]).valueOf(),
              value,
            })) ?? [],
      },
    ];
  };

  getAdoption = (version: string, project: number, display: DisplayOption) => {
    const get24hCountByRelease = this.get24hCountByRelease(version, project, display);
    const get24hCountByProject = this.get24hCountByProject(project, display);

    return defined(get24hCountByRelease) && defined(get24hCountByProject)
      ? percent(get24hCountByRelease, get24hCountByProject)
      : undefined;
  };

  render() {
    const {loading, errored} = this.state;
    const {children} = this.props;

    return children({
      isHealthLoading: loading,
      errored,
      getHealthData: this.getHealthData(),
    });
  }
}

export default withApi(ReleaseHealthRequest);
