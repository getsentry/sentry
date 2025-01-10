import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import MarkLine from 'sentry/components/charts/components/markLine';
import type {CombinedMetricChartProps} from 'sentry/components/metrics/chart/types';
import {t} from 'sentry/locale';
import type {DateString} from 'sentry/types/core';
import {escape} from 'sentry/utils';
import {getFormattedDate, getTimeFormat, getUtcDateString} from 'sentry/utils/dates';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {formatVersion} from 'sentry/utils/versions/formatVersion';

interface Release {
  date: string;
  version: string;
}

interface ReleaseQuery {
  end: DateString;
  environment: Readonly<string[]>;
  project: Readonly<number[]>;
  start: DateString;
  cursor?: string;
  query?: string;
  statsPeriod?: string | null;
}

function getQuery(conditions: any) {
  const query = {};
  Object.keys(conditions).forEach(key => {
    let value = conditions[key];
    if (value && (key === 'start' || key === 'end')) {
      value = getUtcDateString(value);
    }
    if (value) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      query[key] = value;
    }
  });
  return query;
}

export function useReleases() {
  const [releases, setReleases] = useState<Release[] | null>(null);
  const organization = useOrganization();
  const api = useApi();
  const {selection} = usePageFilters();

  const {
    datetime: {start, end, period},
    projects,
    environments,
  } = selection;

  const fetchData = useCallback(async () => {
    const queryObj: ReleaseQuery = {
      start,
      end,
      project: projects,
      environment: environments,
      statsPeriod: period,
    };
    let hasMore = true;
    const newReleases: Release[] = [];
    while (hasMore) {
      try {
        api.clear();

        const [releaseBatch, , resp] = await api.requestPromise(
          `/organizations/${organization.slug}/releases/stats/`,
          {
            includeAllArgs: true,
            method: 'GET',
            query: getQuery(queryObj),
          }
        );
        newReleases.push(...releaseBatch);

        const pageLinks = resp?.getResponseHeader('Link');

        if (pageLinks) {
          const paginationObject = parseLinkHeader(pageLinks);
          hasMore = paginationObject?.next?.results ?? false;
          queryObj.cursor = paginationObject.next!.cursor;
        } else {
          hasMore = false;
        }
      } catch {
        addErrorMessage(t('Error fetching releases'));
        hasMore = false;
      }
    }
    setReleases(newReleases);
  }, [api, start, end, period, projects, environments, organization]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return releases;
}

export function useReleaseSeries() {
  const releases = useReleases();

  const organization = useOrganization();
  const router = useRouter();
  const theme = useTheme();
  const {selection} = usePageFilters();

  const releaseSeries = useMemo(() => {
    const query = organization.features.includes('global-views')
      ? {project: router.location.query.project}
      : {};

    const markLine = MarkLine({
      animation: false,
      lineStyle: {
        color: theme.purple300,
        opacity: 0.3,
        type: 'solid',
      },
      label: {
        show: false,
      },
      data: (releases ?? []).map(release => ({
        xAxis: +new Date(release.date),
        name: formatVersion(release.version, true),
        value: formatVersion(release.version, true),
        onClick: () => {
          router.push(
            normalizeUrl({
              pathname: `/organizations/${
                organization.slug
              }/releases/${encodeURIComponent(release.version)}/`,
              query,
            })
          );
        },
        label: {
          formatter: () => formatVersion(release.version, true),
        },
      })),
      tooltip: {
        trigger: 'item',
        formatter: ({data}: any) => {
          if (!data) {
            return '';
          }
          const format = `MMM D, YYYY ${getTimeFormat()} z`.trim();
          const time = getFormattedDate(data.value, format, {
            local: !selection.datetime.utc,
          });
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
            '</div>',
            '<div class="tooltip-arrow"></div>',
          ].join('');
        },
      },
    });

    return {
      seriesName: 'Releases',
      color: theme.purple200,
      data: [],
      markLine,
      type: 'line' as any,
      name: 'Releases',
    };
  }, [organization, releases, router, theme, selection.datetime.utc]);

  const applyChartProps = useCallback(
    (baseProps: CombinedMetricChartProps): CombinedMetricChartProps => {
      return {
        ...baseProps,
        additionalSeries: baseProps.additionalSeries
          ? [...baseProps.additionalSeries, releaseSeries]
          : [releaseSeries],
      };
    },
    [releaseSeries]
  );

  return {applyChartProps};
}

export type UseMetricReleasesResult = ReturnType<typeof useReleaseSeries>;
