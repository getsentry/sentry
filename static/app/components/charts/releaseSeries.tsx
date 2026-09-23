import {useEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import type {Query} from 'history';
import memoize from 'lodash/memoize';
import partition from 'lodash/partition';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {markLine as createMarkLine} from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';
import type {ResponseMeta} from 'sentry/types/api';
import type {DateString} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {Organization} from 'sentry/types/organization';
import {escape} from 'sentry/utils';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getFormat, getFormattedDate, getUtcDateString} from 'sentry/utils/dates';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {makeReleasesPathname} from 'sentry/views/explore/releases/utils/pathnames';

type ReleaseMetaBasic = {
  date: string;
  version: string;
};

type ReleaseConditions = {
  end: DateString;
  environment: readonly string[];
  project: readonly number[];
  start: DateString;
  cursor?: string;
  query?: string;
  statsPeriod?: string | null;
};

// This is not an exported action/function because releases list uses AsyncComponent
// and this is not re-used anywhere else afaict
function getOrganizationReleases(
  api: Client,
  organization: Organization,
  conditions: ReleaseConditions
) {
  const query: Record<string, string> = {};
  Object.keys(conditions).forEach(key => {
    let value = (conditions as any)[key];
    if (value && (key === 'start' || key === 'end')) {
      value = getUtcDateString(value);
    }
    if (value) {
      query[key] = value;
    }
  });
  api.clear();
  return api.requestPromise(
    getApiUrl('/organizations/$organizationIdOrSlug/releases/stats/', {
      path: {organizationIdOrSlug: organization.slug},
    }),
    {
      includeAllArgs: true,
      method: 'GET',
      query,
    }
  ) as Promise<[ReleaseMetaBasic[], any, ResponseMeta]>;
}

const getOrganizationReleasesMemoized = memoize(
  getOrganizationReleases,
  (_, __, conditions) =>
    Object.values(conditions)
      .map(val => JSON.stringify(val))
      .join('-')
);

export interface ReleaseSeriesProps {
  children: (s: ReleaseSeriesState) => React.ReactNode;
  end: DateString;
  environments: readonly string[];
  projects: readonly number[];
  start: DateString;
  emphasizeReleases?: string[];
  enabled?: boolean;
  memoized?: boolean;
  period?: string | null;
  preserveQueryParams?: boolean;
  query?: string;
  queryExtra?: Query;
  releases?: ReleaseMetaBasic[] | null;
  tooltip?: Exclude<Parameters<typeof createMarkLine>[0], undefined>['tooltip'];
  utc?: boolean | null;
}

type ReleaseSeriesState = {
  releaseSeries: Series[];
  releases: ReleaseMetaBasic[] | null;
};

type UseReleaseSeriesProps = Omit<ReleaseSeriesProps, 'children'>;

/**
 * @deprecated use useReleaseBubbles instead
 */
export function useReleaseSeries({
  start,
  end,
  period,
  environments,
  projects,
  query,
  releases: propReleases,
  enabled = true,
  memoized,
  emphasizeReleases,
  preserveQueryParams,
  queryExtra,
  tooltip,
  utc,
}: UseReleaseSeriesProps): ReleaseSeriesState {
  const api = useApi();
  const organization = useOrganization();
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  // Tooltip formatters live inside echarts and are not re-created when utc changes
  const utcRef = useRef(utc);
  useEffect(() => {
    utcRef.current = utc;
  }, [utc]);

  const [state, setState] = useState<ReleaseSeriesState>({
    releases: null,
    releaseSeries: [],
  });

  // Callers like Discover rebuild Date objects and arrays on every render, so
  // effect deps compare serialized values to avoid re-fetching unchanged data.
  const startKey = start ? getUtcDateString(start) : '';
  const endKey = end ? getUtcDateString(end) : '';
  const projectsKey = [...projects].join(',');
  const environmentsKey = [...environments].join(',');
  const emphasizeReleasesKey = emphasizeReleases?.join(',') ?? '';

  // Stable refs for values used inside closures passed to echarts
  const organizationRef = useRef(organization);
  const locationRef = useRef(location);
  const navigateRef = useRef(navigate);
  const themeRef = useRef(theme);
  const preserveQueryParamsRef = useRef(preserveQueryParams);
  const queryExtraRef = useRef(queryExtra);
  const tooltipRef = useRef(tooltip);
  const environmentsRef = useRef(environments);
  const startRef = useRef(start);
  const endRef = useRef(end);
  const periodRef = useRef(period);

  useEffect(() => {
    organizationRef.current = organization;
    locationRef.current = location;
    navigateRef.current = navigate;
    themeRef.current = theme;
    preserveQueryParamsRef.current = preserveQueryParams;
    queryExtraRef.current = queryExtra;
    tooltipRef.current = tooltip;
    environmentsRef.current = environments;
    startRef.current = start;
    endRef.current = end;
    periodRef.current = period;
  });

  function buildReleaseSeries(releases: ReleaseMetaBasic[]): Series[] {
    const releaseSeries: Series[] = [];

    function makeOneSeries(items: ReleaseMetaBasic[], lineStyle = {}): Series {
      const releaseColor = themeRef.current.tokens.dataviz.semantic.release;

      const extraQuery: Query = {...queryExtraRef.current};
      extraQuery.project = locationRef.current.query.project;
      if (preserveQueryParamsRef.current) {
        extraQuery.environment = [...environmentsRef.current];
        extraQuery.start = startRef.current
          ? getUtcDateString(startRef.current)
          : undefined;
        extraQuery.end = endRef.current ? getUtcDateString(endRef.current) : undefined;
        extraQuery.statsPeriod = periodRef.current || undefined;
      }

      const markLine = createMarkLine({
        animation: false,
        lineStyle: {
          color: releaseColor,
          opacity: 0.3,
          type: 'solid',
          ...lineStyle,
        },
        label: {
          show: false,
        },
        data: items.map((release: ReleaseMetaBasic) => ({
          xAxis: +new Date(release.date),
          name: formatVersion(release.version, true),
          value: formatVersion(release.version, true),

          onClick: () => {
            navigateRef.current({
              pathname: makeReleasesPathname({
                organization: organizationRef.current,
                path: `/${encodeURIComponent(release.version)}/`,
              }),
              query: extraQuery,
            });
          },

          label: {
            formatter: () => formatVersion(release.version, true),
          },
        })),
        tooltip: tooltipRef.current || {
          trigger: 'item',
          formatter: ({data}: any) => {
            // Should only happen when navigating pages
            if (!data) {
              return '';
            }
            const time = getFormattedDate(
              data.value,
              getFormat({timeZone: true, year: true}),
              {
                local: !utcRef.current,
              }
            );
            const version = escape(formatVersion(data.name, true));
            return [
              '<div class="tooltip-series">',
              `<div><span class="tooltip-label"><strong>${t(
                'Release'
              )}</strong></span> ${version}</div>`,
              '</div>',
              '<div class="tooltip-footer">',
              time,
              '</div>',
              '<div class="tooltip-arrow"></div>',
            ].join('');
          },
        },
      });

      return {
        id: 'release-lines',
        seriesName: 'Releases',
        color: releaseColor,
        data: [],
        markLine,
      };
    }

    if (emphasizeReleases?.length) {
      const [unemphasizedReleases, emphasizedReleases] = partition(
        releases,
        release => !emphasizeReleases!.includes(release.version)
      );
      if (unemphasizedReleases.length) {
        releaseSeries.push(makeOneSeries(unemphasizedReleases, {type: 'dotted'}));
      }
      if (emphasizedReleases.length) {
        releaseSeries.push(
          makeOneSeries(emphasizedReleases, {
            opacity: 0.8,
          })
        );
      }
    } else {
      releaseSeries.push(makeOneSeries(releases));
    }

    return releaseSeries;
  }

  useEffect(() => {
    if (propReleases) {
      setState({
        releases: propReleases,
        releaseSeries: buildReleaseSeries(propReleases),
      });
      return;
    }

    if (!enabled) {
      return;
    }

    let cancelled = false;

    async function fetchData() {
      const conditions: ReleaseConditions = {
        start,
        end,
        project: projects,
        environment: environments,
        statsPeriod: period,
        query,
      };

      let hasMore = true;
      const releases: ReleaseMetaBasic[] = [];
      while (hasMore) {
        try {
          const getReleases = memoized
            ? getOrganizationReleasesMemoized
            : getOrganizationReleases;
          const [newReleases, , resp] = await getReleases(api, organization, conditions);
          releases.push(...newReleases);
          if (!cancelled) {
            setState({
              releases,
              releaseSeries: buildReleaseSeries(releases),
            });
          }

          const pageLinks = resp?.getResponseHeader('Link');
          if (pageLinks) {
            const paginationObject = parseLinkHeader(pageLinks);
            hasMore = paginationObject?.next?.results ?? false;
            conditions.cursor = paginationObject.next!.cursor;
          } else {
            hasMore = false;
          }
        } catch {
          addErrorMessage(t('Error fetching releases'));
          hasMore = false;
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
      api.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- serialized keys stand in for start/end/projects/environments
  }, [
    startKey,
    endKey,
    period,
    projectsKey,
    environmentsKey,
    query,
    propReleases,
    enabled,
    memoized,
  ]);

  // Rebuild series when emphasizeReleases changes without re-fetching.
  useEffect(() => {
    setState(prev => {
      if (prev.releases === null) {
        return prev;
      }
      return {
        ...prev,
        releaseSeries: buildReleaseSeries(prev.releases),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- serialized key stands in for emphasizeReleases
  }, [emphasizeReleasesKey]);

  if (!enabled) {
    return {releases: [], releaseSeries: []};
  }

  return state;
}

/**
 * @deprecated use useReleaseSeries hook instead
 */
export function ReleaseSeries({children, ...props}: ReleaseSeriesProps) {
  return children(useReleaseSeries(props));
}
