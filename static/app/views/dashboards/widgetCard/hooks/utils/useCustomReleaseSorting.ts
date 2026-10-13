import {useCallback, useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization, SessionApiResponse} from 'sentry/types/organization';
import type {Release} from 'sentry/types/release';
import {escapeDoubleQuotes} from 'sentry/utils';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {TAG_VALUE_ESCAPE_PATTERN} from 'sentry/utils/queryString';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useProjects} from 'sentry/utils/useProjects';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {WidgetType} from 'sentry/views/dashboards/types';
import {dashboardFiltersToString} from 'sentry/views/dashboards/utils';
import {getWidgetStaleTime} from 'sentry/views/dashboards/widgetCard/hooks/utils/getStaleTime';
import {requiresCustomReleaseSorting} from 'sentry/views/dashboards/widgetCard/releaseWidgetQueries';

function getReleasesQuery(releases: Release[]): {
  releaseQueryString: string;
  releasesUsed: string[];
} {
  const releasesArray: string[] = [];
  releasesArray.push(releases[0]!.version);
  for (let i = 1; i < releases.length; i++) {
    releasesArray.push(releases[i]!.version);
  }
  const releaseCondition = `release:[${releasesArray.map(v => (new RegExp(TAG_VALUE_ESCAPE_PATTERN, 'g').test(v) ? `"${escapeDoubleQuotes(v)}"` : v))}]`;
  if (releases.length < 10) {
    return {releaseQueryString: releaseCondition, releasesUsed: releasesArray};
  }
  if (releases.length > 10 && releaseCondition.length > 1500) {
    return getReleasesQuery(releases.slice(0, -10));
  }
  return {releaseQueryString: releaseCondition, releasesUsed: releasesArray};
}

/**
 * Release widgets sorted by release can't be sorted by the metrics API. Instead, this
 * fetches the most recent releases, limits the widget's queries to them, and orders the
 * response groups to match. It also labels groups with project slugs instead of IDs.
 */
export function useCustomReleaseSorting({
  dashboardFilters,
  enabled,
  limit,
  organization,
  pageFilters,
  widget,
}: {
  enabled: boolean;
  organization: Organization;
  pageFilters: PageFilters;
  widget: Widget;
  dashboardFilters?: DashboardFilters;
  limit?: number;
}) {
  const {projects} = useProjects();
  const firstQuery = widget.queries[0];
  const isCustomReleaseSorting = !!firstQuery && requiresCustomReleaseSorting(firstQuery);

  const {data: releases, error} = useQuery({
    ...apiOptions.as<Release[]>()('/organizations/$organizationIdOrSlug/releases/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        sort: 'date',
        project: pageFilters.projects,
        per_page: 50,
        environment: pageFilters.environments,
        // Propagate release filters
        query: dashboardFilters
          ? dashboardFiltersToString(dashboardFilters, WidgetType.RELEASE)
          : undefined,
      },
      staleTime: getWidgetStaleTime(pageFilters),
    }),
    enabled: enabled && isCustomReleaseSorting,
    retry: false,
  });

  const {releaseCondition, releaseOrder} = useMemo(() => {
    if (!isCustomReleaseSorting || !releases?.length) {
      return {releaseCondition: '', releaseOrder: []};
    }
    if (releases.length === 1) {
      const {version} = releases[0]!;
      return {releaseCondition: `release:${version}`, releaseOrder: [version]};
    }
    const {releaseQueryString, releasesUsed} = getReleasesQuery(releases);
    const isDescending = firstQuery.orderby.startsWith('-');
    return {
      releaseCondition: releaseQueryString,
      releaseOrder: isDescending ? releasesUsed : [...releasesUsed].reverse(),
    };
  }, [firstQuery, isCustomReleaseSorting, releases]);

  const sortedWidget = useMemo(() => {
    // The sessions API doesn't support the release condition
    if (!releaseCondition || firstQuery?.columns.includes('session.status')) {
      return widget;
    }
    return {
      ...widget,
      queries: widget.queries.map(query => ({
        ...query,
        conditions: `${query.conditions} ${releaseCondition}`,
      })),
    };
  }, [firstQuery, releaseCondition, widget]);

  const sortGroups = useCallback(
    (data: SessionApiResponse): SessionApiResponse => {
      const groups = releaseOrder.length
        ? [...data.groups]
            .sort(
              (group1, group2) =>
                releaseOrder.indexOf(group1.by.release as string) -
                releaseOrder.indexOf(group2.by.release as string)
            )
            .slice(0, limit)
        : data.groups;

      return {
        ...data,
        groups: groups.map(group => {
          if (!group.by.project) {
            return group;
          }
          // Show the project slug instead of its ID for a more readable display
          const project = projects.find(p => p.id === String(group.by.project));
          return {
            ...group,
            by: {...group.by, project: project?.slug ?? group.by.project},
          };
        }),
      };
    },
    [limit, projects, releaseOrder]
  );

  return {
    errorMessage: error
      ? error instanceof RequestError && typeof error.responseJSON?.error === 'string'
        ? error.responseJSON.error
        : t('Error sorting by releases')
      : undefined,
    isLoading: isCustomReleaseSorting && !releases && !error,
    sortGroups,
    widget: sortedWidget,
  };
}
