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
import {
  GlobalSelection,
  HealthStatsPeriodOption,
  Organization,
  SessionApiResponse,
} from 'app/types';
import {defined, percent} from 'app/utils';
import {QueryResults, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import withApi from 'app/utils/withApi';

import {DisplayOption} from '../list/utils';

import {getCrashFreePercent} from '.';

function omitIgnoredProps(props: Props) {
  return omit(props, [
    'api',
    'organization',
    'children',
    'selection.datetime.utc',
    'location',
  ]);
}

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
function reduceTimeSeriesGroups(
  acc: number[],
  group: SessionApiResponse['groups'][number],
  field: 'count_unique(user)' | 'sum(session)'
) {
  group.series[field].forEach((value, index) => (acc[index] = (acc[index] ?? 0) + value));

  return acc;
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
  releasesReloading?: boolean;
  healthStatsPeriod?: HealthStatsPeriodOption;
};
type State = {
  loading: boolean;
  errored: boolean;
  statusCountByReleaseInPeriod: SessionApiResponse | null;
  totalCountByReleaseIn24h: SessionApiResponse | null;
  totalCountByProjectIn24h: SessionApiResponse | null;
  statusCountByProjectInPeriod: SessionApiResponse | null;
};

class ReleaseHealthRequest extends React.Component<Props, State> {
  state: State = {
    loading: false,
    errored: false,
    statusCountByReleaseInPeriod: null,
    totalCountByReleaseIn24h: null,
    totalCountByProjectIn24h: null,
    statusCountByProjectInPeriod: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.releasesReloading) {
      return;
    }
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
    const {api, healthStatsPeriod} = this.props;

    api.clear();
    this.setState({
      loading: true,
      errored: false,
      statusCountByReleaseInPeriod: null,
      totalCountByReleaseIn24h: null,
      totalCountByProjectIn24h: null,
    });

    const promises = [
      this.fetchStatusCountByReleaseInPeriod(),
      this.fetchTotalCountByReleaseIn24h(),
      this.fetchTotalCountByProjectIn24h(),
    ];

    if (healthStatsPeriod === HealthStatsPeriodOption.AUTO) {
      promises.push(this.fetchStatusCountByProjectInPeriod());
    }

    try {
      const [
        statusCountByReleaseInPeriod,
        totalCountByReleaseIn24h,
        totalCountByProjectIn24h,
        statusCountByProjectInPeriod,
      ] = await Promise.all(promises);

      this.setState({
        loading: false,
        statusCountByReleaseInPeriod,
        totalCountByReleaseIn24h,
        totalCountByProjectIn24h,
        statusCountByProjectInPeriod,
      });
    } catch (error) {
      addErrorMessage(error.responseJSON?.detail ?? t('Error loading health data'));
      this.setState({
        loading: false,
        errored: true,
      });
    }
  };

  /**
   * Used to calculate crash free rate, count histogram (This Release series), and crash count
   */
  async fetchStatusCountByReleaseInPeriod() {
    const {api, display} = this.props;

    const response: SessionApiResponse = await api.requestPromise(this.path, {
      query: {
        ...this.baseQueryParams,
        field: [
          ...new Set([...display.map(d => this.displayToField(d)), 'sum(session)']),
        ], // this request needs to be fired for sessions in both display options (because of crash count), removing potential sum(session) duplicated with Set
        groupBy: ['project', 'release', 'session.status'],
      },
    });

    return response;
  }

  /**
   * Used to calculate count histogram (Total Project series)
   */
  async fetchStatusCountByProjectInPeriod() {
    const {api, display} = this.props;

    const response: SessionApiResponse = await api.requestPromise(this.path, {
      query: {
        ...this.baseQueryParams,
        query: undefined,
        field: [
          ...new Set([...display.map(d => this.displayToField(d)), 'sum(session)']),
        ],
        groupBy: ['project', 'session.status'],
      },
    });

    return response;
  }

  /**
   * Used to calculate adoption, and count histogram (This Release series)
   */
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

  /**
   * Used to calculate adoption, and count histogram (Total Project series)
   */
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

  getTimeSeries = (version: string, project: number, display: DisplayOption) => {
    const {healthStatsPeriod} = this.props;
    if (healthStatsPeriod === HealthStatsPeriodOption.AUTO) {
      return this.getPeriodTimeSeries(version, project, display);
    }

    return this.get24hTimeSeries(version, project, display);
  };

  get24hTimeSeries = (version: string, project: number, display: DisplayOption) => {
    const {totalCountByReleaseIn24h, totalCountByProjectIn24h} = this.state;
    const field = this.displayToField(display);

    const intervals = totalCountByProjectIn24h?.intervals ?? [];

    const projectData = totalCountByProjectIn24h?.groups.find(
      ({by}) => by.project === project
    )?.series[field];

    const releaseData = totalCountByReleaseIn24h?.groups.find(
      ({by}) => by.project === project && by.release === version
    )?.series[field];

    return [
      {
        seriesName: t('This Release'),
        data: intervals?.map((interval, index) => ({
          name: moment(interval).valueOf(),
          value: releaseData?.[index] ?? 0,
        })),
      },
      {
        seriesName: t('Total Project'),
        data: intervals?.map((interval, index) => ({
          name: moment(interval).valueOf(),
          value: projectData?.[index] ?? 0,
        })),
        z: 0,
      },
    ];
  };

  getPeriodTimeSeries = (version: string, project: number, display: DisplayOption) => {
    const {statusCountByReleaseInPeriod, statusCountByProjectInPeriod} = this.state;
    const field = this.displayToField(display);

    const intervals = statusCountByProjectInPeriod?.intervals ?? [];

    const projectData = statusCountByProjectInPeriod?.groups
      .filter(({by}) => by.project === project)
      ?.reduce((acc, group) => reduceTimeSeriesGroups(acc, group, field), [] as number[]);

    const releaseData = statusCountByReleaseInPeriod?.groups
      .filter(({by}) => by.project === project && by.release === version)
      ?.reduce((acc, group) => reduceTimeSeriesGroups(acc, group, field), [] as number[]);

    return [
      {
        seriesName: t('This Release'),
        data: intervals?.map((interval, index) => ({
          name: moment(interval).valueOf(),
          value: releaseData?.[index] ?? 0,
        })),
      },
      {
        seriesName: t('Total Project'),
        data: intervals?.map((interval, index) => ({
          name: moment(interval).valueOf(),
          value: projectData?.[index] ?? 0,
        })),
        z: 0,
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
