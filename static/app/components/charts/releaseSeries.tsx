import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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

interface UseReleaseSeriesProps {
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

function buildReleaseSeries({
  releases,
  emphasizeReleases,
  color,
  tooltip,
  utc,
  onReleaseClick,
}: {
  color: string;
  onReleaseClick: (version: string) => void;
  releases: ReleaseMetaBasic[];
  emphasizeReleases?: string[];
  tooltip?: UseReleaseSeriesProps['tooltip'];
  utc?: boolean | null;
}): Series[] {
  function makeOneSeries(items: ReleaseMetaBasic[], lineStyle = {}): Series {
    const markLine = createMarkLine({
      animation: false,
      lineStyle: {
        color,
        opacity: 0.3,
        type: 'solid',
        ...lineStyle,
      },
      label: {
        show: false,
      },
      data: items.map(release => ({
        xAxis: +new Date(release.date),
        name: formatVersion(release.version, true),
        value: formatVersion(release.version, true),
        onClick: () => onReleaseClick(release.version),
        label: {
          formatter: () => formatVersion(release.version, true),
        },
      })),
      tooltip: tooltip || {
        trigger: 'item',
        formatter: ({data}: any) => {
          // Should only happen when navigating pages
          if (!data) {
            return '';
          }
          const time = getFormattedDate(
            data.value,
            getFormat({timeZone: true, year: true}),
            {local: !utc}
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
      color,
      data: [],
      markLine,
    };
  }

  if (!emphasizeReleases?.length) {
    return [makeOneSeries(releases)];
  }

  const [unemphasizedReleases, emphasizedReleases] = partition(
    releases,
    release => !emphasizeReleases.includes(release.version)
  );
  const releaseSeries: Series[] = [];
  if (unemphasizedReleases.length) {
    releaseSeries.push(makeOneSeries(unemphasizedReleases, {type: 'dotted'}));
  }
  if (emphasizedReleases.length) {
    releaseSeries.push(makeOneSeries(emphasizedReleases, {opacity: 0.8}));
  }
  return releaseSeries;
}

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

  const [fetchedReleases, setFetchedReleases] = useState<ReleaseMetaBasic[] | null>(null);
  const releases = propReleases ?? fetchedReleases;

  // Callers like Discover rebuild Date objects and arrays on every render, so
  // effect deps compare serialized values to avoid re-fetching unchanged data.
  const startKey = start ? getUtcDateString(start) : '';
  const endKey = end ? getUtcDateString(end) : '';
  const projectsKey = [...projects].join(',');
  const environmentsKey = [...environments].join(',');

  // Read at click time so the memoized series doesn't rebuild whenever a
  // caller passes freshly-allocated navigation params.
  const clickContextRef = useRef({
    environments,
    end,
    location,
    navigate,
    organization,
    period,
    preserveQueryParams,
    queryExtra,
    start,
  });
  useEffect(() => {
    clickContextRef.current = {
      environments,
      end,
      location,
      navigate,
      organization,
      period,
      preserveQueryParams,
      queryExtra,
      start,
    };
  });

  const handleReleaseClick = useCallback((version: string) => {
    const ctx = clickContextRef.current;
    const extraQuery: Query = {...ctx.queryExtra, project: ctx.location.query.project};
    if (ctx.preserveQueryParams) {
      extraQuery.environment = [...ctx.environments];
      extraQuery.start = ctx.start ? getUtcDateString(ctx.start) : undefined;
      extraQuery.end = ctx.end ? getUtcDateString(ctx.end) : undefined;
      extraQuery.statsPeriod = ctx.period || undefined;
    }
    ctx.navigate({
      pathname: makeReleasesPathname({
        organization: ctx.organization,
        path: `/${encodeURIComponent(version)}/`,
      }),
      query: extraQuery,
    });
  }, []);

  const releaseSeries = useMemo(
    () =>
      releases
        ? buildReleaseSeries({
            releases,
            emphasizeReleases,
            color: theme.tokens.dataviz.semantic.release,
            tooltip,
            utc,
            onReleaseClick: handleReleaseClick,
          })
        : [],
    [releases, emphasizeReleases, theme, tooltip, utc, handleReleaseClick]
  );

  useEffect(() => {
    if (propReleases || !enabled) {
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
      const allReleases: ReleaseMetaBasic[] = [];
      while (hasMore) {
        try {
          const getReleases = memoized
            ? getOrganizationReleasesMemoized
            : getOrganizationReleases;
          const [newReleases, , resp] = await getReleases(api, organization, conditions);
          allReleases.push(...newReleases);
          if (!cancelled) {
            setFetchedReleases([...allReleases]);
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

  if (!enabled) {
    return {releases: [], releaseSeries: []};
  }

  return {releases, releaseSeries};
}
