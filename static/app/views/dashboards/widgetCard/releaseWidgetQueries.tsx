import {useCallback, useEffect, useRef, useState} from 'react';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';
import trimStart from 'lodash/trimStart';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {isSelectionEqual} from 'sentry/components/organizations/pageFilters/utils';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {SessionApiResponse} from 'sentry/types/organization';
import type {Release} from 'sentry/types/release';
import {escapeDoubleQuotes} from 'sentry/utils';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {stripDerivedMetricsPrefix} from 'sentry/utils/discover/fields';
import {TOP_N} from 'sentry/utils/discover/types';
import {TAG_VALUE_ESCAPE_PATTERN} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {ReleasesConfig} from 'sentry/views/dashboards/datasetConfig/releases';
import type {DashboardFilters, Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import {
  DEFAULT_TABLE_LIMIT,
  DisplayType,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {dashboardFiltersToString} from 'sentry/views/dashboards/utils';
import type {WidgetQueryQueue} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import {
  DERIVED_STATUS_METRICS_PATTERN,
  DerivedStatusFields,
  DISABLED_SORT,
  METRICS_EXPRESSION_TO_FIELD,
} from 'sentry/views/dashboards/widgetBuilder/releaseWidget/fields';

import type {
  GenericWidgetQueriesChildrenProps,
  GenericWidgetQueriesProps,
} from './genericWidgetQueries';
import GenericWidgetQueries from './genericWidgetQueries';

interface ReleaseWidgetQueriesProps {
  children: (props: GenericWidgetQueriesChildrenProps) => React.JSX.Element;
  selection: PageFilters;
  widget: Widget;
  cursor?: string;
  dashboardFilters?: DashboardFilters;
  limit?: number;
  onDataFetchStart?: () => void;
  onDataFetched?: (results: {
    tableResults?: TableDataWithTitle[];
    timeseriesResults?: Series[];
  }) => void;
  queue?: WidgetQueryQueue;
}

export function derivedMetricsToField(field: string): string {
  return METRICS_EXPRESSION_TO_FIELD[field] ?? field;
}

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
 * Given a list of requested fields, this function returns
 * 'aggregates' which is a list of aggregate functions that
 * can be passed to either Metrics or Sessions endpoints,
 * 'derivedStatusFields' which need to be requested from the
 * Metrics endpoint and 'injectFields' which are fields not
 * requested but required to calculate the value of a derived
 * status field so will need to be stripped away in post processing.
 */
export function resolveDerivedStatusFields(
  fields: string[],
  orderby: string,
  useSessionAPI: boolean
): {
  aggregates: string[];
  derivedStatusFields: string[];
  injectedFields: string[];
} {
  const aggregates = fields.map(stripDerivedMetricsPrefix);
  const derivedStatusFields = aggregates.filter(agg =>
    Object.values(DerivedStatusFields).includes(agg as DerivedStatusFields)
  );

  const injectedFields: string[] = [];

  const rawOrderby = trimStart(orderby, '-');
  const unsupportedOrderby =
    DISABLED_SORT.includes(rawOrderby) || useSessionAPI || rawOrderby === 'release';

  if (rawOrderby && !unsupportedOrderby && !fields.includes(rawOrderby)) {
    if (!injectedFields.includes(rawOrderby)) {
      injectedFields.push(rawOrderby);
    }
  }

  if (!useSessionAPI) {
    return {aggregates, derivedStatusFields, injectedFields};
  }

  derivedStatusFields.forEach(field => {
    const result = field.match(DERIVED_STATUS_METRICS_PATTERN);
    if (result) {
      if (result[2] === 'user' && !aggregates.includes('count_unique(user)')) {
        injectedFields.push('count_unique(user)');
        aggregates.push('count_unique(user)');
      }
      if (result[2] === 'session' && !aggregates.includes('sum(session)')) {
        injectedFields.push('sum(session)');
        aggregates.push('sum(session)');
      }
    }
  });

  return {aggregates, derivedStatusFields, injectedFields};
}

export function requiresCustomReleaseSorting(query: WidgetQuery): boolean {
  const useMetricsAPI = !query.columns.includes('session.status');
  const rawOrderby = trimStart(query.orderby, '-');
  return useMetricsAPI && rawOrderby === 'release';
}

function getLimit(displayType: DisplayType, limit?: number) {
  switch (displayType) {
    case DisplayType.TOP_N:
      return TOP_N;
    case DisplayType.TABLE:
      return limit ?? DEFAULT_TABLE_LIMIT;
    case DisplayType.BIG_NUMBER:
      return 1;
    default:
      return limit ?? 20; // TODO(dam): Can be changed to undefined once [INGEST-1079] is resolved
  }
}

function customDidUpdateComparator(
  prevProps: GenericWidgetQueriesProps<SessionApiResponse, SessionApiResponse>,
  nextProps: GenericWidgetQueriesProps<SessionApiResponse, SessionApiResponse>
) {
  const {loading, limit, widget, cursor, organization, selection, dashboardFilters} =
    nextProps;
  const ignoredWidgetProps: Array<Partial<keyof Widget>> = [
    'queries',
    'title',
    'id',
    'layout',
    'tempId',
    'widgetType',
    'tableWidths',
  ];
  const ignoredQueryProps: Array<Partial<keyof WidgetQuery>> = [
    'name',
    'fields',
    'aggregates',
    'columns',
  ];
  return (
    limit !== prevProps.limit ||
    organization.slug !== prevProps.organization.slug ||
    !isEqual(dashboardFilters, prevProps.dashboardFilters) ||
    !isSelectionEqual(selection, prevProps.selection) ||
    // If the widget changed (ignore unimportant fields, + queries as they are handled lower)
    !isEqual(
      omit(widget, ignoredWidgetProps),
      omit(prevProps.widget, ignoredWidgetProps)
    ) ||
    // If the queries changed (ignore unimportant name, + fields as they are handled lower)
    !isEqual(
      widget.queries.map(q => omit(q, ignoredQueryProps)),
      prevProps.widget.queries.map(q => omit(q, ignoredQueryProps))
    ) ||
    // If the fields changed (ignore falsy/empty fields -> they can happen after clicking on Add Series)
    !isEqual(
      widget.queries.flatMap(q => q.fields?.filter(field => !!field)),
      prevProps.widget.queries.flatMap(q => q.fields?.filter(field => !!field))
    ) ||
    !isEqual(
      widget.queries.flatMap(q => q.aggregates.filter(aggregate => !!aggregate)),
      prevProps.widget.queries.flatMap(q => q.aggregates.filter(aggregate => !!aggregate))
    ) ||
    !isEqual(
      widget.queries.flatMap(q => q.columns.filter(column => !!column)),
      prevProps.widget.queries.flatMap(q => q.columns.filter(column => !!column))
    ) ||
    loading !== prevProps.loading ||
    cursor !== prevProps.cursor
  );
}

function ReleaseWidgetQueries({
  widget,
  selection,
  dashboardFilters,
  cursor,
  limit,
  onDataFetched,
  onDataFetchStart,
  children,
  queue,
}: ReleaseWidgetQueriesProps) {
  const config = ReleasesConfig;

  const mounted = useRef(false);
  const allProjects = useProjects();
  const api = useApi();
  const organization = useOrganization();
  const [requestErrorMessage, setRequestErrorMessage] = useState<string | undefined>(
    undefined
  );
  const [releases, setReleases] = useState<Release[] | undefined>(undefined);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fetchReleases = useCallback(async () => {
    setRequestErrorMessage(undefined);

    try {
      const releaseResponse = await api.requestPromise(
        `/organizations/${organization.slug}/releases/`,
        {
          method: 'GET',
          data: {
            sort: 'date',
            project: selection.projects,
            per_page: 50,
            environment: selection.environments,
            // Propagate release filters
            query: dashboardFilters
              ? dashboardFiltersToString(dashboardFilters, WidgetType.RELEASE)
              : undefined,
          },
        }
      );
      if (!mounted.current) {
        return;
      }
      setReleases(releaseResponse);
    } catch (error: any) {
      if (!mounted.current) {
        return;
      }

      const message = error.responseJSON
        ? error.responseJSON.error
        : t('Error sorting by releases');
      setRequestErrorMessage(message);
      addErrorMessage(message);
    }
  }, [
    api,
    dashboardFilters,
    organization.slug,
    selection.environments,
    selection.projects,
  ]);

  const fetchReleasesForCustomSorting =
    widget.queries[0] && requiresCustomReleaseSorting(widget.queries[0]);
  useEffect(() => {
    if (fetchReleasesForCustomSorting) {
      fetchReleases();
    }
  }, [fetchReleasesForCustomSorting, fetchReleases]);

  const transformWidget = useCallback(
    (initialWidget: Widget): Widget => {
      const transformedWidget = cloneDeep(initialWidget);

      const isCustomReleaseSorting = requiresCustomReleaseSorting(
        transformedWidget.queries[0]!
      );
      const isDescending = transformedWidget.queries[0]!.orderby.startsWith('-');
      const useSessionAPI =
        transformedWidget.queries[0]!.columns.includes('session.status');

      let releaseCondition = '';
      const releasesArray: string[] = [];
      if (isCustomReleaseSorting) {
        if (releases && releases.length === 1) {
          releaseCondition += `release:${releases[0]!.version}`;
          releasesArray.push(releases[0]!.version);
        }
        if (releases && releases.length > 1) {
          const {releaseQueryString, releasesUsed} = getReleasesQuery(releases);
          releaseCondition += releaseQueryString;
          releasesArray.push(...releasesUsed);

          if (!isDescending) {
            releasesArray.reverse();
          }
        }
      }

      if (!useSessionAPI) {
        transformedWidget.queries.forEach(query => {
          query.conditions =
            query.conditions + (releaseCondition === '' ? '' : ` ${releaseCondition}`);
        });
      }

      return transformedWidget;
    },
    [releases]
  );

  const afterFetchData = useCallback(
    (data: SessionApiResponse) => {
      const isDescending = widget.queries[0]!.orderby.startsWith('-');

      const releasesArray: string[] = [];
      if (requiresCustomReleaseSorting(widget.queries[0]!)) {
        if (releases && releases.length === 1) {
          releasesArray.push(releases[0]!.version);
        }
        if (releases && releases.length > 1) {
          const {releasesUsed} = getReleasesQuery(releases);
          releasesArray.push(...releasesUsed);

          if (!isDescending) {
            releasesArray.reverse();
          }
        }
      }

      if (releasesArray.length) {
        data.groups.sort((group1, group2) => {
          const release1 = group1.by.release;
          const release2 = group2.by.release;
          // @ts-expect-error TS(2345): Argument of type 'string | number | undefined' is ... Remove this comment to see the full error message
          return releasesArray.indexOf(release1) - releasesArray.indexOf(release2);
        });
        data.groups = data.groups.slice(0, getLimit(widget.displayType, limit));
      }

      data.groups.forEach(group => {
        // Convert the project ID in the grouping results to the project slug
        // for a more human readable display
        if (group.by.project) {
          const project = allProjects.projects.find(
            p => p.id === String(group.by.project)
          );
          group.by.project = project?.slug ?? group.by.project;
        }
      });
    },
    [allProjects.projects, limit, releases, widget.displayType, widget.queries]
  );

  return (
    <GenericWidgetQueries<SessionApiResponse, SessionApiResponse>
      queue={queue}
      config={config}
      api={api}
      organization={organization}
      selection={selection}
      widget={transformWidget(widget)}
      dashboardFilters={dashboardFilters}
      cursor={cursor}
      limit={getLimit(widget.displayType, limit)}
      onDataFetched={onDataFetched}
      onDataFetchStart={onDataFetchStart}
      loading={requiresCustomReleaseSorting(widget.queries[0]!) ? !releases : undefined}
      customDidUpdateComparator={customDidUpdateComparator}
      afterFetchTableData={afterFetchData}
      afterFetchSeriesData={afterFetchData}
    >
      {({errorMessage, ...rest}) =>
        children({
          errorMessage: requestErrorMessage ?? errorMessage,
          ...rest,
        })
      }
    </GenericWidgetQueries>
  );
}

export default ReleaseWidgetQueries;
