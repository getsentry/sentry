import {Component} from 'react';
import type {Location} from 'history';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import moment from 'moment-timezone';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import {
  getDiffInMinutes,
  ONE_WEEK,
  TWENTY_FOUR_HOURS,
  TWO_WEEKS,
} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {URL_PARAM} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization, SessionApiResponse} from 'sentry/types/organization';
import {SessionFieldWithOperation} from 'sentry/types/organization';
import {HealthStatsPeriodOption} from 'sentry/types/release';
import {defined, percent} from 'sentry/utils';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withApi from 'sentry/utils/withApi';

import {getCrashFreePercent} from '../utils';

import {ReleasesDisplayOption} from './releasesDisplayOptions';

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

export function sessionDisplayToField(display: ReleasesDisplayOption) {
  switch (display) {
    case ReleasesDisplayOption.USERS:
      return SessionFieldWithOperation.USERS;
    case ReleasesDisplayOption.SESSIONS:
    default:
      return SessionFieldWithOperation.SESSIONS;
  }
}

export type ReleasesRequestRenderProps = {
  errored: boolean;
  getHealthData: ReturnType<ReleasesRequest['getHealthData']>;
  isHealthLoading: boolean;
};

type Props = {
  api: Client;
  children: (renderProps: ReleasesRequestRenderProps) => React.ReactNode;
  display: ReleasesDisplayOption[];
  location: Location;
  organization: Organization;
  releases: string[];
  selection: PageFilters;
  defaultStatsPeriod?: string;
  disable?: boolean;
  healthStatsPeriod?: HealthStatsPeriodOption;
  releasesReloading?: boolean;
};
type State = {
  errored: boolean;
  loading: boolean;
  statusCountByProjectInPeriod: SessionApiResponse | null;
  statusCountByReleaseInPeriod: SessionApiResponse | null;
  totalCountByProjectIn24h: SessionApiResponse | null;
  totalCountByProjectInPeriod: SessionApiResponse | null;
  totalCountByReleaseIn24h: SessionApiResponse | null;
  totalCountByReleaseInPeriod: SessionApiResponse | null;
};

class ReleasesRequest extends Component<Props, State> {
  state: State = {
    loading: false,
    errored: false,
    statusCountByReleaseInPeriod: null,
    totalCountByReleaseIn24h: null,
    totalCountByProjectIn24h: null,
    statusCountByProjectInPeriod: null,
    totalCountByReleaseInPeriod: null,
    totalCountByProjectInPeriod: null,
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
      query: new MutableSearch(
        releases.reduce<string[]>((acc, release, index, allReleases) => {
          acc.push(`release:"${release}"`);
          if (index < allReleases.length - 1) {
            acc.push('OR');
          }

          return acc;
        }, [])
      ).formatString(),
      interval: getInterval(selection.datetime),
      ...normalizeDateTimeParams(pick(location.query, Object.values(URL_PARAM)), {
        defaultStatsPeriod,
      }),
    };
  }

  fetchData = async () => {
    const {api, healthStatsPeriod, disable} = this.props;

    if (disable) {
      return;
    }

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
      promises.push(this.fetchTotalCountByReleaseInPeriod());
      promises.push(this.fetchTotalCountByProjectInPeriod());
    }

    try {
      const [
        statusCountByReleaseInPeriod,
        totalCountByReleaseIn24h,
        totalCountByProjectIn24h,
        statusCountByProjectInPeriod,
        totalCountByReleaseInPeriod,
        totalCountByProjectInPeriod,
      ] = await Promise.all(promises);

      this.setState({
        loading: false,
        statusCountByReleaseInPeriod: statusCountByReleaseInPeriod!,
        totalCountByReleaseIn24h: totalCountByReleaseIn24h!,
        totalCountByProjectIn24h: totalCountByProjectIn24h!,
        statusCountByProjectInPeriod: statusCountByProjectInPeriod!,
        totalCountByReleaseInPeriod: totalCountByReleaseInPeriod!,
        totalCountByProjectInPeriod: totalCountByProjectInPeriod!,
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
          ...new Set([...display.map(d => sessionDisplayToField(d)), 'sum(session)']),
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
          ...new Set([...display.map(d => sessionDisplayToField(d)), 'sum(session)']),
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
        field: display.map(d => sessionDisplayToField(d)),
        groupBy: ['project', 'release'],
        interval: '1h',
        statsPeriod: '24h',
      },
    });

    return response;
  }

  async fetchTotalCountByReleaseInPeriod() {
    const {api, display} = this.props;

    const response: SessionApiResponse = await api.requestPromise(this.path, {
      query: {
        ...this.baseQueryParams,
        field: display.map(d => sessionDisplayToField(d)),
        groupBy: ['project', 'release'],
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
        field: display.map(d => sessionDisplayToField(d)),
        groupBy: ['project'],
        interval: '1h',
        statsPeriod: '24h',
      },
    });

    return response;
  }

  async fetchTotalCountByProjectInPeriod() {
    const {api, display} = this.props;

    const response: SessionApiResponse = await api.requestPromise(this.path, {
      query: {
        ...this.baseQueryParams,
        query: undefined,
        field: display.map(d => sessionDisplayToField(d)),
        groupBy: ['project'],
      },
    });

    return response;
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

  getCrashCount = (version: string, project: number, display: ReleasesDisplayOption) => {
    const {statusCountByReleaseInPeriod} = this.state;
    const field = sessionDisplayToField(display);

    return statusCountByReleaseInPeriod?.groups.find(
      ({by}) =>
        by.release === version &&
        by.project === project &&
        by['session.status'] === 'crashed'
    )?.totals[field];
  };

  getCrashFreeRate = (
    version: string,
    project: number,
    display: ReleasesDisplayOption
  ) => {
    const {statusCountByReleaseInPeriod} = this.state;
    const field = sessionDisplayToField(display);

    const totalCount = statusCountByReleaseInPeriod?.groups
      .filter(({by}) => by.release === version && by.project === project)
      ?.reduce((acc, group) => acc + group.totals[field]!, 0);

    const crashedCount = this.getCrashCount(version, project, display);

    return !defined(totalCount) || totalCount === 0
      ? null
      : getCrashFreePercent(100 - percent(crashedCount ?? 0, totalCount ?? 0));
  };

  get24hCountByRelease = (
    version: string,
    project: number,
    display: ReleasesDisplayOption
  ) => {
    const {totalCountByReleaseIn24h} = this.state;
    const field = sessionDisplayToField(display);

    return totalCountByReleaseIn24h?.groups
      .filter(({by}) => by.release === version && by.project === project)
      ?.reduce((acc, group) => acc + group.totals[field]!, 0);
  };

  getPeriodCountByRelease = (
    version: string,
    project: number,
    display: ReleasesDisplayOption
  ) => {
    const {totalCountByReleaseInPeriod} = this.state;
    const field = sessionDisplayToField(display);

    return totalCountByReleaseInPeriod?.groups
      .filter(({by}) => by.release === version && by.project === project)
      ?.reduce((acc, group) => acc + group.totals[field]!, 0);
  };

  get24hCountByProject = (project: number, display: ReleasesDisplayOption) => {
    const {totalCountByProjectIn24h} = this.state;
    const field = sessionDisplayToField(display);

    return totalCountByProjectIn24h?.groups
      .filter(({by}) => by.project === project)
      ?.reduce((acc, group) => acc + group.totals[field]!, 0);
  };

  getPeriodCountByProject = (project: number, display: ReleasesDisplayOption) => {
    const {totalCountByProjectInPeriod} = this.state;
    const field = sessionDisplayToField(display);

    return totalCountByProjectInPeriod?.groups
      .filter(({by}) => by.project === project)
      ?.reduce((acc, group) => acc + group.totals[field]!, 0);
  };

  getTimeSeries = (version: string, project: number, display: ReleasesDisplayOption) => {
    const {healthStatsPeriod} = this.props;
    if (healthStatsPeriod === HealthStatsPeriodOption.AUTO) {
      return this.getPeriodTimeSeries(version, project, display);
    }

    return this.get24hTimeSeries(version, project, display);
  };

  get24hTimeSeries = (
    version: string,
    project: number,
    display: ReleasesDisplayOption
  ) => {
    const {totalCountByReleaseIn24h, totalCountByProjectIn24h} = this.state;
    const field = sessionDisplayToField(display);

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

  getPeriodTimeSeries = (
    version: string,
    project: number,
    display: ReleasesDisplayOption
  ) => {
    const {statusCountByReleaseInPeriod, statusCountByProjectInPeriod} = this.state;
    const field = sessionDisplayToField(display);

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

  getAdoption = (version: string, project: number, display: ReleasesDisplayOption) => {
    const {healthStatsPeriod} = this.props;

    const countByRelease = (
      healthStatsPeriod === HealthStatsPeriodOption.AUTO
        ? this.getPeriodCountByRelease
        : this.get24hCountByRelease
    )(version, project, display);
    const countByProject = (
      healthStatsPeriod === HealthStatsPeriodOption.AUTO
        ? this.getPeriodCountByProject
        : this.get24hCountByProject
    )(project, display);

    return defined(countByRelease) && defined(countByProject)
      ? percent(countByRelease, countByProject)
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

export default withApi(ReleasesRequest);
