import React from 'react';
import {withRouter} from 'react-router';
import {WithRouterProps} from 'react-router/lib/withRouter';
import {EChartOption} from 'echarts/lib/echarts';
import {Query} from 'history';
import isEqual from 'lodash/isEqual';
import memoize from 'lodash/memoize';
import partition from 'lodash/partition';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import MarkLine from 'app/components/charts/components/markLine';
import {t} from 'app/locale';
import {DateString, Organization} from 'app/types';
import {Series} from 'app/types/echarts';
import {escape} from 'app/utils';
import {getFormattedDate, getUtcDateString} from 'app/utils/dates';
import {formatVersion} from 'app/utils/formatters';
import parseLinkHeader from 'app/utils/parseLinkHeader';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

type ReleaseMetaBasic = {
  version: string;
  date: string;
};

type ReleaseConditions = {
  start: DateString;
  end: DateString;
  project: Readonly<number[]>;
  environment: Readonly<string[]>;
  statsPeriod?: string;
  cursor?: string;
};

// This is not an exported action/function because releases list uses AsyncComponent
// and this is not re-used anywhere else afaict
function getOrganizationReleases(
  api: Client,
  organization: Organization,
  conditions: ReleaseConditions
) {
  const query = {};
  Object.keys(conditions).forEach(key => {
    let value = conditions[key];
    if (value && (key === 'start' || key === 'end')) {
      value = getUtcDateString(value);
    }
    if (value) {
      query[key] = value;
    }
  });
  api.clear();
  return api.requestPromise(`/organizations/${organization.slug}/releases/stats/`, {
    includeAllArgs: true,
    method: 'GET',
    query,
  }) as Promise<[ReleaseMetaBasic[], any, JQueryXHR]>;
}

type Props = WithRouterProps & {
  api: Client;
  organization: Organization;
  children: (s: State) => React.ReactNode;
  projects: Readonly<number[]>;
  environments: Readonly<string[]>;
  start: DateString;
  end: DateString;
  period?: string;
  utc?: boolean | null;
  releases?: ReleaseMetaBasic[] | null;
  tooltip?: EChartOption.Tooltip;
  memoized?: boolean;
  preserveQueryParams?: boolean;
  emphasizeReleases?: string[];
  queryExtra?: Query;
};

type State = {
  releases: ReleaseMetaBasic[] | null;
  releaseSeries: Series[];
};

class ReleaseSeries extends React.Component<Props, State> {
  state = {
    releases: null,
    releaseSeries: [],
  };

  componentDidMount() {
    this._isMounted = true;
    const {releases} = this.props;

    if (releases) {
      // No need to fetch releases if passed in from props
      this.setReleasesWithSeries(releases);
      return;
    }

    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (
      !isEqual(prevProps.projects, this.props.projects) ||
      !isEqual(prevProps.environments, this.props.environments) ||
      !isEqual(prevProps.start, this.props.start) ||
      !isEqual(prevProps.end, this.props.end) ||
      !isEqual(prevProps.period, this.props.period)
    ) {
      this.fetchData();
    } else if (!isEqual(prevProps.emphasizeReleases, this.props.emphasizeReleases)) {
      this.setReleasesWithSeries(this.state.releases);
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
    this.props.api.clear();
  }

  _isMounted: boolean = false;

  getOrganizationReleasesMemoized = memoize(
    (api, conditions, organization) =>
      getOrganizationReleases(api, conditions, organization),
    (_, __, conditions) =>
      Object.values(conditions)
        .map(val => JSON.stringify(val))
        .join('-')
  );

  async fetchData() {
    const {
      api,
      organization,
      projects,
      environments,
      period,
      start,
      end,
      memoized,
    } = this.props;
    const conditions: ReleaseConditions = {
      start,
      end,
      project: projects,
      environment: environments,
      statsPeriod: period,
    };
    let hasMore = true;
    const releases: ReleaseMetaBasic[] = [];
    while (hasMore) {
      try {
        const getReleases = memoized
          ? this.getOrganizationReleasesMemoized
          : getOrganizationReleases;
        const [newReleases, , xhr] = await getReleases(api, organization, conditions);
        releases.push(...newReleases);
        if (this._isMounted) {
          this.setReleasesWithSeries(releases);
        }

        const pageLinks = xhr && xhr.getResponseHeader('Link');
        if (pageLinks) {
          const paginationObject = parseLinkHeader(pageLinks);
          hasMore = paginationObject?.next?.results ?? false;
          conditions.cursor = paginationObject.next.cursor;
        } else {
          hasMore = false;
        }
      } catch {
        addErrorMessage(t('Error fetching releases'));
        hasMore = false;
      }
    }
  }

  setReleasesWithSeries(releases) {
    const {emphasizeReleases = []} = this.props;
    const releaseSeries: Series[] = [];

    if (emphasizeReleases.length) {
      const [unemphasizedReleases, emphasizedReleases] = partition(
        releases,
        release => !emphasizeReleases.includes(release.version)
      );
      if (unemphasizedReleases.length) {
        releaseSeries.push(this.getReleaseSeries(unemphasizedReleases, {type: 'dotted'}));
      }
      if (emphasizedReleases.length) {
        releaseSeries.push(
          this.getReleaseSeries(emphasizedReleases, {
            opacity: 0.8,
          })
        );
      }
    } else {
      releaseSeries.push(this.getReleaseSeries(releases));
    }

    this.setState({
      releases,
      releaseSeries,
    });
  }

  getReleaseSeries = (releases, lineStyle = {}) => {
    const {
      organization,
      router,
      tooltip,
      environments,
      start,
      end,
      period,
      preserveQueryParams,
      queryExtra,
    } = this.props;

    const query = {...queryExtra};
    if (organization.features.includes('global-views')) {
      query.project = router.location.query.project;
    }
    if (preserveQueryParams) {
      query.environment = [...environments];
      query.start = start ? getUtcDateString(start) : undefined;
      query.end = end ? getUtcDateString(end) : undefined;
      query.statsPeriod = period || undefined;
    }

    const markLine = MarkLine({
      animation: false,
      lineStyle: {
        color: theme.purple300,
        opacity: 0.3,
        type: 'solid',
        ...lineStyle,
      },
      label: {
        show: false,
      },
      data: releases.map(release => ({
        xAxis: +new Date(release.date),
        name: formatVersion(release.version, true),
        value: formatVersion(release.version, true),
        onClick: () => {
          router.push({
            pathname: `/organizations/${organization.slug}/releases/${release.version}/`,
            query,
          });
        },
        label: {
          formatter: () => formatVersion(release.version, true),
        },
      })),
    });

    // TODO(tonyx): This conflicts with the types declaration of `MarkLine`
    // if we add it in the constructor. So we opt to add it here so typescript
    // doesn't complain.
    (markLine as any).tooltip =
      tooltip ||
      ({
        trigger: 'item',
        formatter: ({data}: EChartOption.Tooltip.Format) => {
          // XXX using this.props here as this function does not get re-run
          // unless projects are changed. Using a closure variable would result
          // in stale values.
          const time = getFormattedDate(data.value, 'MMM D, YYYY LT', {
            local: !this.props.utc,
          });
          const version = escape(formatVersion(data.name, true));
          return [
            '<div class="tooltip-series">',
            `<div><span class="tooltip-label"><strong>${t(
              'Release'
            )}</strong></span> ${version}</div>`,
            '</div>',
            '<div class="tooltip-date">',
            time,
            '</div>',
            '</div>',
            '<div class="tooltip-arrow"></div>',
          ].join('');
        },
      } as EChartOption.Tooltip);

    return {
      seriesName: 'Releases',
      data: [],
      markLine,
    };
  };

  render() {
    const {children} = this.props;

    return children({
      releases: this.state.releases,
      releaseSeries: this.state.releaseSeries,
    });
  }
}

export default withRouter(withOrganization(withApi(ReleaseSeries)));
