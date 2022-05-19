import {useEffect, useMemo, useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import isEmpty from 'lodash/isEmpty';
import omit from 'lodash/omit';
import set from 'lodash/set';
import trimStart from 'lodash/trimStart';

import {validateWidget} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import {generateOrderOptions} from 'sentry/components/dashboards/widgetQueriesForm';
import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import LoadingError from 'sentry/components/loadingError';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {
  DateString,
  Organization,
  PageFilters,
  SelectValue,
  SessionField,
  TagCollection,
} from 'sentry/types';
import {defined, objectIsEmpty} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {
  explodeField,
  generateFieldAsString,
  getAggregateAlias,
  getColumnsAndAggregates,
  getColumnsAndAggregatesAsStrings,
  isEquation,
  QueryFieldValue,
  stripDerivedMetricsPrefix,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';
import withPageFilters from 'sentry/utils/withPageFilters';
import withTags from 'sentry/utils/withTags';
import {
  assignTempId,
  enforceWidgetHeightValues,
  generateWidgetsAfterCompaction,
  getDefaultWidgetHeight,
} from 'sentry/views/dashboardsV2/layoutUtils';
import {
  DashboardDetails,
  DashboardListItem,
  DashboardWidgetSource,
  DisplayType,
  Widget,
  WidgetQuery,
  WidgetType,
} from 'sentry/views/dashboardsV2/types';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

import {DEFAULT_STATS_PERIOD} from '../data';
import {getNumEquations} from '../utils';

import {ColumnsStep} from './buildSteps/columnsStep';
import {DashboardStep} from './buildSteps/dashboardStep';
import {DataSetStep} from './buildSteps/dataSetStep';
import {FilterResultsStep} from './buildSteps/filterResultsStep';
import {GroupByStep} from './buildSteps/groupByStep';
import {SortByStep} from './buildSteps/sortByStep';
import {VisualizationStep} from './buildSteps/visualizationStep';
import {YAxisStep} from './buildSteps/yAxisStep';
import {Footer} from './footer';
import {Header} from './header';
import {
  DataSet,
  DEFAULT_RESULTS_LIMIT,
  getIsTimeseriesChart,
  getParsedDefaultWidgetQuery,
  getResultsLimit,
  mapErrors,
  NEW_DASHBOARD_ID,
  normalizeQueries,
} from './utils';
import {WidgetLibrary} from './widgetLibrary';

function getDataSetQuery(widgetBuilderNewDesign: boolean): Record<DataSet, WidgetQuery> {
  return {
    [DataSet.EVENTS]: {
      name: '',
      fields: ['count()'],
      columns: [],
      fieldAliases: [],
      aggregates: ['count()'],
      conditions: '',
      orderby: widgetBuilderNewDesign ? '-count()' : '',
    },
    [DataSet.ISSUES]: {
      name: '',
      fields: ['issue', 'assignee', 'title'] as string[],
      columns: ['issue', 'assignee', 'title'],
      fieldAliases: [],
      aggregates: [],
      conditions: '',
      orderby: widgetBuilderNewDesign ? IssueSortOptions.DATE : '',
    },
    [DataSet.RELEASES]: {
      name: '',
      fields: [`crash_free_rate(${SessionField.SESSION})`],
      columns: [],
      fieldAliases: [],
      aggregates: [`crash_free_rate(${SessionField.SESSION})`],
      conditions: '',
      orderby: widgetBuilderNewDesign ? `-crash_free_rate(${SessionField.SESSION})` : '',
    },
  };
}

const WIDGET_TYPE_TO_DATA_SET = {
  [WidgetType.DISCOVER]: DataSet.EVENTS,
  [WidgetType.ISSUE]: DataSet.ISSUES,
  [WidgetType.RELEASE]: DataSet.RELEASES,
};

const DATA_SET_TO_WIDGET_TYPE = {
  [DataSet.EVENTS]: WidgetType.DISCOVER,
  [DataSet.ISSUES]: WidgetType.ISSUE,
  [DataSet.RELEASES]: WidgetType.RELEASE,
};

interface RouteParams {
  dashboardId: string;
  orgId: string;
  widgetIndex?: string;
}

interface QueryData {
  queryConditions: string[];
  queryFields: string[];
  queryNames: string[];
  queryOrderby: string;
}

interface Props extends RouteComponentProps<RouteParams, {}> {
  dashboard: DashboardDetails;
  onSave: (widgets: Widget[]) => void;
  organization: Organization;
  selection: PageFilters;
  tags: TagCollection;
  displayType?: DisplayType;
  end?: DateString;
  start?: DateString;
  statsPeriod?: string | null;
}

interface State {
  dashboards: DashboardListItem[];
  dataSet: DataSet;
  displayType: Widget['displayType'];
  interval: Widget['interval'];
  limit: Widget['limit'];
  loading: boolean;
  queries: Widget['queries'];
  title: string;
  userHasModified: boolean;
  errors?: Record<string, any>;
  selectedDashboard?: SelectValue<string>;
  widgetToBeUpdated?: Widget;
}

function WidgetBuilder({
  dashboard,
  params,
  location,
  organization,
  selection,
  start,
  end,
  statsPeriod,
  onSave,
  router,
  tags,
}: Props) {
  const {widgetIndex, orgId, dashboardId} = params;
  const {source, displayType, defaultTitle, defaultTableColumns, limit} = location.query;
  const defaultWidgetQuery = getParsedDefaultWidgetQuery(
    location.query.defaultWidgetQuery
  );

  // Feature flag for new widget builder design. This feature is still a work in progress and not yet available internally.
  const widgetBuilderNewDesign = organization.features.includes(
    'new-widget-builder-experience-design'
  );
  const hasReleaseHealthFeature = organization.features.includes('dashboards-releases');

  const filteredDashboardWidgets = dashboard.widgets.filter(({widgetType}) => {
    if (widgetType === WidgetType.RELEASE) {
      return hasReleaseHealthFeature;
    }
    return true;
  });

  const isEditing = defined(widgetIndex);
  const widgetIndexNum = Number(widgetIndex);
  const isValidWidgetIndex =
    widgetIndexNum >= 0 &&
    widgetIndexNum < filteredDashboardWidgets.length &&
    Number.isInteger(widgetIndexNum);
  const orgSlug = organization.slug;

  // Construct PageFilters object using statsPeriod/start/end props so we can
  // render widget graph using saved timeframe from Saved/Prebuilt Query
  const pageFilters: PageFilters = statsPeriod
    ? {...selection, datetime: {start: null, end: null, period: statsPeriod, utc: null}}
    : start && end
    ? {...selection, datetime: {start, end, period: null, utc: null}}
    : selection;

  // when opening from discover or issues page, the user selects the dashboard in the widget UI
  const notDashboardsOrigin = [
    DashboardWidgetSource.DISCOVERV2,
    DashboardWidgetSource.ISSUE_DETAILS,
  ].includes(source);

  const api = useApi();

  const [state, setState] = useState<State>(() => {
    const defaultState: State = {
      title: defaultTitle ?? t('Custom Widget'),
      displayType:
        (widgetBuilderNewDesign && displayType === DisplayType.TOP_N
          ? DisplayType.AREA
          : displayType) ?? DisplayType.TABLE,
      interval: '5m',
      queries: [],
      limit: limit ? Number(limit) : undefined,
      errors: undefined,
      loading: !!notDashboardsOrigin,
      dashboards: [],
      userHasModified: false,
      dataSet: DataSet.EVENTS,
    };

    if (defaultWidgetQuery) {
      if (widgetBuilderNewDesign) {
        defaultState.queries = [
          {
            ...defaultWidgetQuery,
            orderby:
              defaultWidgetQuery.orderby ||
              generateOrderOptions({
                widgetType: WidgetType.DISCOVER,
                widgetBuilderNewDesign,
                columns: defaultWidgetQuery.columns,
                aggregates: defaultWidgetQuery.aggregates,
              })[0].value,
          },
        ];
      } else {
        defaultState.queries = [{...defaultWidgetQuery}];
      }

      if (
        ![DisplayType.TABLE, DisplayType.TOP_N].includes(defaultState.displayType) &&
        !(
          getIsTimeseriesChart(defaultState.displayType) &&
          defaultState.queries[0].columns.length
        )
      ) {
        defaultState.queries[0].orderby = '';
      }
    } else {
      defaultState.queries = [
        {...getDataSetQuery(widgetBuilderNewDesign)[DataSet.EVENTS]},
      ];
    }

    return defaultState;
  });

  const [widgetToBeUpdated, setWidgetToBeUpdated] = useState<Widget | null>(null);

  // For analytics around widget library selection
  const [latestLibrarySelectionTitle, setLatestLibrarySelectionTitle] = useState<
    string | null
  >(null);

  useEffect(() => {
    trackAdvancedAnalyticsEvent('dashboards_views.widget_builder.opened', {
      organization,
      new_widget: !isEditing,
    });

    if (objectIsEmpty(tags)) {
      loadOrganizationTags(api, organization.slug, selection);
    }

    if (isEditing && isValidWidgetIndex) {
      const widgetFromDashboard = filteredDashboardWidgets[widgetIndexNum];

      let queries;
      let newDisplayType = widgetFromDashboard.displayType;
      let newLimit = widgetFromDashboard.limit;
      if (widgetFromDashboard.displayType === DisplayType.TOP_N) {
        newLimit = DEFAULT_RESULTS_LIMIT;
        newDisplayType = DisplayType.AREA;

        queries = normalizeQueries({
          displayType: newDisplayType,
          queries: widgetFromDashboard.queries,
          widgetType: widgetFromDashboard.widgetType ?? WidgetType.DISCOVER,
          widgetBuilderNewDesign,
        }).map(query => ({
          ...query,
          // Use the last aggregate because that's where the y-axis is stored
          aggregates: query.aggregates.length
            ? [query.aggregates[query.aggregates.length - 1]]
            : [],
        }));
      } else {
        queries = normalizeQueries({
          displayType: newDisplayType,
          queries: widgetFromDashboard.queries,
          widgetType: widgetFromDashboard.widgetType ?? WidgetType.DISCOVER,
          widgetBuilderNewDesign,
        });
      }

      setState({
        title: widgetFromDashboard.title,
        displayType: newDisplayType,
        interval: widgetFromDashboard.interval,
        queries,
        errors: undefined,
        loading: false,
        dashboards: [],
        userHasModified: false,
        dataSet: widgetFromDashboard.widgetType
          ? WIDGET_TYPE_TO_DATA_SET[widgetFromDashboard.widgetType]
          : DataSet.EVENTS,
        limit: newLimit,
      });
      setWidgetToBeUpdated(widgetFromDashboard);
    }
    // This should only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function fetchDashboards() {
      const promise: Promise<DashboardListItem[]> = api.requestPromise(
        `/organizations/${organization.slug}/dashboards/`,
        {
          method: 'GET',
          query: {sort: 'myDashboardsAndRecentlyViewed'},
        }
      );

      try {
        const dashboards = await promise;
        setState(prevState => ({...prevState, dashboards, loading: false}));
      } catch (error) {
        const errorMessage = t('Unable to fetch dashboards');
        addErrorMessage(errorMessage);
        handleXhrErrorResponse(errorMessage)(error);
        setState(prevState => ({...prevState, loading: false}));
      }
    }

    if (notDashboardsOrigin) {
      fetchDashboards();
    }

    if (widgetBuilderNewDesign) {
      setState(prevState => ({
        ...prevState,
        selectedDashboard: {
          label: dashboard.title,
          value: dashboard.id || NEW_DASHBOARD_ID,
        },
      }));
    }
  }, [
    api,
    dashboard.id,
    dashboard.title,
    notDashboardsOrigin,
    organization.slug,
    source,
    widgetBuilderNewDesign,
  ]);

  useEffect(() => {
    fetchOrgMembers(api, organization.slug, selection.projects?.map(String));
  }, [selection.projects, api, organization.slug]);

  const widgetType =
    state.dataSet === DataSet.EVENTS
      ? WidgetType.DISCOVER
      : state.dataSet === DataSet.ISSUES
      ? WidgetType.ISSUE
      : WidgetType.RELEASE;

  const currentWidget = {
    title: state.title,
    displayType: state.displayType,
    interval: state.interval,
    queries: state.queries,
    limit: state.limit,
    widgetType,
  };

  const currentDashboardId = state.selectedDashboard?.value ?? dashboardId;
  const queryParamsWithoutSource = omit(location.query, 'source');
  const previousLocation = {
    pathname:
      defined(currentDashboardId) && currentDashboardId !== NEW_DASHBOARD_ID
        ? `/organizations/${orgId}/dashboard/${currentDashboardId}/`
        : `/organizations/${orgId}/dashboards/${NEW_DASHBOARD_ID}/`,
    query: isEmpty(queryParamsWithoutSource) ? undefined : queryParamsWithoutSource,
  };

  const isTimeseriesChart = getIsTimeseriesChart(state.displayType);

  const isTabularChart = [DisplayType.TABLE, DisplayType.TOP_N].includes(
    state.displayType
  );

  function updateFieldsAccordingToDisplayType(newDisplayType: DisplayType) {
    setState(prevState => {
      const newState = cloneDeep(prevState);
      const normalized = normalizeQueries({
        displayType: newDisplayType,
        queries: prevState.queries,
        widgetType: DATA_SET_TO_WIDGET_TYPE[prevState.dataSet],
        widgetBuilderNewDesign,
      });

      if (newDisplayType === DisplayType.TOP_N) {
        // TOP N display should only allow a single query
        normalized.splice(1);
      }

      if (
        (prevState.displayType === DisplayType.TABLE &&
          widgetToBeUpdated?.widgetType &&
          WIDGET_TYPE_TO_DATA_SET[widgetToBeUpdated.widgetType] === DataSet.ISSUES) ||
        (prevState.dataSet === DataSet.RELEASES &&
          newDisplayType === DisplayType.WORLD_MAP)
      ) {
        // World Map display type only supports Events Dataset
        // so set state to default events query.
        set(
          newState,
          'queries',
          normalizeQueries({
            displayType: newDisplayType,
            queries: [{...getDataSetQuery(widgetBuilderNewDesign)[DataSet.EVENTS]}],
            widgetType: WidgetType.DISCOVER,
            widgetBuilderNewDesign,
          })
        );
        set(newState, 'dataSet', DataSet.EVENTS);
        return {...newState, errors: undefined};
      }

      if (!prevState.userHasModified) {
        // If the Widget is an issue widget,
        if (
          newDisplayType === DisplayType.TABLE &&
          widgetToBeUpdated?.widgetType === WidgetType.ISSUE
        ) {
          set(newState, 'queries', widgetToBeUpdated.queries);
          set(newState, 'dataSet', DataSet.ISSUES);
          return {...newState, errors: undefined};
        }

        // Default widget provided by Add to Dashboard from Discover
        if (defaultWidgetQuery && defaultTableColumns) {
          // If switching to Table visualization, use saved query fields for Y-Axis if user has not made query changes
          // This is so the widget can reflect the same columns as the table in Discover without requiring additional user input
          if (newDisplayType === DisplayType.TABLE) {
            normalized.forEach(query => {
              const tableQuery = getColumnsAndAggregates(defaultTableColumns);
              query.columns = [...tableQuery.columns];
              query.aggregates = [...tableQuery.aggregates];
              query.fields = [...defaultTableColumns];
              query.orderby =
                defaultWidgetQuery.orderby ??
                (query.fields.length ? `${query.fields[0]}` : '-');
            });
          } else if (newDisplayType === displayType) {
            // When switching back to original display type, default fields back to the fields provided from the discover query
            normalized.forEach(query => {
              query.fields = [
                ...defaultWidgetQuery.columns,
                ...defaultWidgetQuery.aggregates,
              ];
              query.aggregates = [...defaultWidgetQuery.aggregates];
              query.columns = [...defaultWidgetQuery.columns];
              if (
                !!defaultWidgetQuery.orderby &&
                (displayType === DisplayType.TOP_N || defaultWidgetQuery.columns.length)
              ) {
                query.orderby = defaultWidgetQuery.orderby;
              }
            });
          }
        }
      }

      if (prevState.dataSet === DataSet.ISSUES) {
        set(newState, 'dataSet', DataSet.EVENTS);
      }

      set(newState, 'queries', normalized);

      if (widgetBuilderNewDesign) {
        if (
          getIsTimeseriesChart(newDisplayType) &&
          normalized[0].columns.filter(column => !!column).length
        ) {
          // If a limit already exists (i.e. going between timeseries) then keep it,
          // otherwise calculate a limit
          newState.limit =
            prevState.limit ??
            Math.min(
              getResultsLimit(normalized.length, normalized[0].columns.length),
              DEFAULT_RESULTS_LIMIT
            );
        } else {
          newState.limit = undefined;
        }
      }

      return {...newState, errors: undefined};
    });
  }

  function getUpdateWidgetIndex() {
    if (!widgetToBeUpdated) {
      return -1;
    }

    return dashboard.widgets.findIndex(widget => {
      if (defined(widget.id)) {
        return widget.id === widgetToBeUpdated.id;
      }

      if (defined(widget.tempId)) {
        return widget.tempId === widgetToBeUpdated.tempId;
      }

      return false;
    });
  }

  function handleDisplayTypeOrTitleChange<
    F extends keyof Pick<State, 'displayType' | 'title'>
  >(field: F, value: State[F]) {
    trackAdvancedAnalyticsEvent('dashboards_views.widget_builder.change', {
      from: source,
      field,
      value,
      widget_type: widgetType,
      organization,
      new_widget: !isEditing,
    });

    setState(prevState => {
      const newState = cloneDeep(prevState);
      set(newState, field, value);
      return {...newState, errors: undefined};
    });

    if (field === 'displayType' && value !== state.displayType) {
      updateFieldsAccordingToDisplayType(value as DisplayType);
    }
  }

  function handleDataSetChange(newDataSet: string) {
    setState(prevState => {
      const newState = cloneDeep(prevState);
      newState.queries.splice(0, newState.queries.length);
      set(newState, 'dataSet', newDataSet);

      if (newDataSet === DataSet.ISSUES) {
        set(newState, 'displayType', DisplayType.TABLE);
      }

      newState.queries.push(
        ...(widgetToBeUpdated?.widgetType &&
        WIDGET_TYPE_TO_DATA_SET[widgetToBeUpdated.widgetType] === newDataSet
          ? widgetToBeUpdated.queries
          : [{...getDataSetQuery(widgetBuilderNewDesign)[newDataSet]}])
      );

      set(newState, 'userHasModified', true);
      return {...newState, errors: undefined};
    });
  }

  function handleAddSearchConditions() {
    setState(prevState => {
      const newState = cloneDeep(prevState);
      const query = cloneDeep(getDataSetQuery(widgetBuilderNewDesign)[prevState.dataSet]);
      query.fields = prevState.queries[0].fields;
      query.aggregates = prevState.queries[0].aggregates;
      query.columns = prevState.queries[0].columns;
      query.orderby = prevState.queries[0].orderby;
      newState.queries.push(query);
      return newState;
    });
  }

  function handleQueryRemove(index: number) {
    setState(prevState => {
      const newState = cloneDeep(prevState);
      newState.queries.splice(index, 1);
      return {...newState, errors: undefined};
    });
  }

  function handleQueryChange(queryIndex: number, newQuery: WidgetQuery) {
    setState(prevState => {
      const newState = cloneDeep(prevState);
      set(newState, `queries.${queryIndex}`, newQuery);
      set(newState, 'userHasModified', true);
      return {...newState, errors: undefined};
    });
  }

  function handleYAxisOrColumnFieldChange(
    newFields: QueryFieldValue[],
    isColumn = false
  ) {
    const fieldStrings = newFields
      .map(generateFieldAsString)
      .map(field =>
        state.dataSet === DataSet.RELEASES ? stripDerivedMetricsPrefix(field) : field
      );

    const columnsAndAggregates = isColumn
      ? getColumnsAndAggregatesAsStrings(newFields)
      : undefined;

    const newState = cloneDeep(state);

    const disableSortBy =
      widgetType === WidgetType.RELEASE && fieldStrings.includes('session.status');

    const newQueries = state.queries.map(query => {
      const isDescending = query.orderby.startsWith('-');
      const orderbyPrefix = isDescending ? '-' : '';
      const rawOrderby = trimStart(query.orderby, '-');
      const prevAggregateFieldStrings = query.aggregates.map(aggregate =>
        state.dataSet === DataSet.RELEASES
          ? stripDerivedMetricsPrefix(aggregate)
          : aggregate
      );
      const newQuery = cloneDeep(query);

      if (disableSortBy) {
        newQuery.orderby = '';
      }

      if (isColumn) {
        newQuery.fields = fieldStrings;
        newQuery.aggregates = columnsAndAggregates?.aggregates ?? [];
        if (state.dataSet === DataSet.RELEASES && newQuery.aggregates.length === 0) {
          // Release Health widgets require an aggregate in tables
          const defaultReleaseHealthAggregate = `crash_free_rate(${SessionField.SESSION})`;
          newQuery.aggregates = [defaultReleaseHealthAggregate];
          newQuery.fields = [...newQuery.fields, defaultReleaseHealthAggregate];
        }
      } else if (state.displayType === DisplayType.TOP_N) {
        // Top N queries use n-1 fields for columns and the nth field for y-axis
        newQuery.fields = [
          ...(newQuery.fields?.slice(0, newQuery.fields.length - 1) ?? []),
          ...fieldStrings,
        ];
        newQuery.aggregates = [
          ...newQuery.aggregates.slice(0, newQuery.aggregates.length - 1),
          ...fieldStrings,
        ];
      } else {
        newQuery.fields = [...newQuery.columns, ...fieldStrings];
        newQuery.aggregates = fieldStrings;
      }

      // Prevent overwriting columns when setting y-axis for time series
      if (!(widgetBuilderNewDesign && isTimeseriesChart) && isColumn) {
        newQuery.columns = columnsAndAggregates?.columns ?? [];
      }

      if (!fieldStrings.includes(rawOrderby) && query.orderby !== '') {
        if (
          !widgetBuilderNewDesign &&
          prevAggregateFieldStrings.length === newFields.length &&
          prevAggregateFieldStrings.includes(rawOrderby)
        ) {
          // The aggregate that was used in orderby has changed. Get the new field.
          let newOrderByValue =
            fieldStrings[prevAggregateFieldStrings.indexOf(rawOrderby)];

          if (!stripEquationPrefix(newOrderByValue ?? '')) {
            newOrderByValue = '';
          }

          newQuery.orderby = `${orderbyPrefix}${newOrderByValue}`;
        } else {
          const isFromAggregates = newQuery.aggregates.includes(rawOrderby);
          const isCustomEquation = isEquation(rawOrderby);
          const isUsedInGrouping = newQuery.columns.includes(rawOrderby);

          const keepCurrentOrderby =
            isFromAggregates || isCustomEquation || isUsedInGrouping;
          const firstAggregateAlias = isEquation(newQuery.aggregates[0] ?? '')
            ? `equation[${getNumEquations(newQuery.aggregates) - 1}]`
            : fieldStrings[0];

          newQuery.orderby = widgetBuilderNewDesign
            ? (keepCurrentOrderby && newQuery.orderby) ||
              `${orderbyPrefix}${firstAggregateAlias}`
            : '';
        }
      }

      if (widgetBuilderNewDesign) {
        newQuery.fieldAliases = columnsAndAggregates?.fieldAliases ?? [];
      }

      return newQuery;
    });

    set(newState, 'queries', newQueries);
    set(newState, 'userHasModified', true);

    if (widgetBuilderNewDesign && isTimeseriesChart) {
      const groupByFields = newState.queries[0].columns.filter(
        field => !(field === 'equation|')
      );
      if (groupByFields.length === 0) {
        set(newState, 'limit', undefined);
      } else {
        set(
          newState,
          'limit',
          Math.min(
            newState.limit ?? DEFAULT_RESULTS_LIMIT,
            getResultsLimit(newQueries.length, newQueries[0].aggregates.length)
          )
        );
      }
    }

    setState(newState);
  }

  function handleGroupByChange(newFields: QueryFieldValue[]) {
    const fieldStrings = newFields.map(generateFieldAsString);

    const newState = cloneDeep(state);

    const newQueries = state.queries.map(query => {
      const newQuery = cloneDeep(query);
      newQuery.columns = fieldStrings;
      const orderby = trimStart(newQuery.orderby, '-');
      const aggregateAliasFieldStrings = newQuery.aggregates.map(getAggregateAlias);

      if (!fieldStrings.length) {
        // The grouping was cleared, so clear the orderby
        newQuery.orderby = '';
      } else if (widgetBuilderNewDesign && !newQuery.orderby) {
        const orderOptions = generateOrderOptions({
          widgetType: widgetType ?? WidgetType.DISCOVER,
          widgetBuilderNewDesign,
          columns: query.columns,
          aggregates: query.aggregates,
        });
        let orderOption: string;
        // If no orderby options are available because of DISABLED_SORTS
        if (!!!orderOptions.length && state.dataSet === DataSet.RELEASES) {
          newQuery.orderby = '';
        } else {
          orderOption = orderOptions[0].value;
          newQuery.orderby = `-${orderOption}`;
        }
      } else if (
        !widgetBuilderNewDesign &&
        aggregateAliasFieldStrings.length &&
        !aggregateAliasFieldStrings.includes(orderby) &&
        !newQuery.columns.includes(orderby) &&
        !isEquation(orderby)
      ) {
        // If the orderby isn't contained in either aggregates or columns, choose the first aggregate
        const isDescending = newQuery.orderby.startsWith('-');
        const prefix = orderby && !isDescending ? '' : '-';
        const firstAggregateAlias = isEquation(aggregateAliasFieldStrings[0])
          ? `equation[${getNumEquations(aggregateAliasFieldStrings) - 1}]`
          : aggregateAliasFieldStrings[0];
        newQuery.orderby = `${prefix}${firstAggregateAlias}`;
      }
      return newQuery;
    });

    set(newState, 'userHasModified', true);
    set(newState, 'queries', newQueries);

    const groupByFields = newState.queries[0].columns.filter(
      field => !(field === 'equation|')
    );

    if (groupByFields.length === 0) {
      set(newState, 'limit', undefined);
    } else {
      set(
        newState,
        'limit',
        Math.min(
          newState.limit ?? DEFAULT_RESULTS_LIMIT,
          getResultsLimit(newQueries.length, newQueries[0].aggregates.length)
        )
      );
    }

    setState(newState);
  }

  function handleLimitChange(newLimit: number) {
    setState(prevState => ({...prevState, limit: newLimit}));
  }

  function handleSortByChange(newSortBy: string) {
    const newState = cloneDeep(state);

    state.queries.forEach((query, index) => {
      const newQuery = cloneDeep(query);
      newQuery.orderby = newSortBy;
      set(newState, `queries.${index}`, newQuery);
    });

    set(newState, 'userHasModified', true);
    setState(newState);
  }

  function handleDelete() {
    if (!isEditing) {
      return;
    }

    let nextWidgetList = [...dashboard.widgets];
    const updateWidgetIndex = getUpdateWidgetIndex();
    nextWidgetList.splice(updateWidgetIndex, 1);
    nextWidgetList = generateWidgetsAfterCompaction(nextWidgetList);

    onSave(nextWidgetList);
    router.push(previousLocation);
  }

  async function handleSave() {
    const widgetData: Widget = assignTempId(currentWidget);

    if (widgetToBeUpdated) {
      widgetData.layout = widgetToBeUpdated?.layout;
    }

    // Only Table and Top N views need orderby
    if (!widgetBuilderNewDesign && !isTabularChart) {
      widgetData.queries.forEach(query => {
        query.orderby = '';
      });
    }

    if (!widgetBuilderNewDesign) {
      widgetData.queries.forEach(query => omit(query, 'fieldAliases'));
    }

    // Only Time Series charts shall have a limit
    if (widgetBuilderNewDesign && !isTimeseriesChart) {
      widgetData.limit = undefined;
    }

    if (!(await dataIsValid(widgetData))) {
      return;
    }

    if (latestLibrarySelectionTitle) {
      // User has selected a widget library in this session
      trackAdvancedAnalyticsEvent('dashboards_views.widget_library.add_widget', {
        organization,
        title: latestLibrarySelectionTitle,
      });
    }

    if (notDashboardsOrigin) {
      submitFromSelectedDashboard(widgetData);
      return;
    }

    if (!!widgetToBeUpdated) {
      let nextWidgetList = [...dashboard.widgets];
      const updateWidgetIndex = getUpdateWidgetIndex();
      const nextWidgetData = {...widgetData, id: widgetToBeUpdated.id};

      // Only modify and re-compact if the default height has changed
      if (
        getDefaultWidgetHeight(widgetToBeUpdated.displayType) !==
        getDefaultWidgetHeight(widgetData.displayType)
      ) {
        nextWidgetList[updateWidgetIndex] = enforceWidgetHeightValues(nextWidgetData);
        nextWidgetList = generateWidgetsAfterCompaction(nextWidgetList);
      } else {
        nextWidgetList[updateWidgetIndex] = nextWidgetData;
      }

      onSave(nextWidgetList);
      addSuccessMessage(t('Updated widget.'));
      goToDashboards(dashboardId ?? NEW_DASHBOARD_ID);
      trackAdvancedAnalyticsEvent('dashboards_views.widget_builder.save', {
        organization,
        data_set: widgetData.widgetType ?? WidgetType.DISCOVER,
        new_widget: false,
      });
      return;
    }

    onSave([...dashboard.widgets, widgetData]);
    addSuccessMessage(t('Added widget.'));
    goToDashboards(dashboardId ?? NEW_DASHBOARD_ID);
    trackAdvancedAnalyticsEvent('dashboards_views.widget_builder.save', {
      organization,
      data_set: widgetData.widgetType ?? WidgetType.DISCOVER,
      new_widget: true,
    });
  }

  async function dataIsValid(widgetData: Widget): Promise<boolean> {
    if (notDashboardsOrigin) {
      // Validate that a dashboard was selected since api call to /dashboards/widgets/ does not check for dashboard
      if (
        !state.selectedDashboard ||
        !(
          state.dashboards.find(
            ({title, id}) =>
              title === state.selectedDashboard?.label &&
              id === state.selectedDashboard?.value
          ) || state.selectedDashboard.value === NEW_DASHBOARD_ID
        )
      ) {
        setState({
          ...state,
          errors: {...state.errors, dashboard: t('This field may not be blank')},
        });
        return false;
      }
    }

    setState({...state, loading: true});

    try {
      await validateWidget(api, organization.slug, widgetData);
      return true;
    } catch (error) {
      setState({
        ...state,
        loading: false,
        errors: {...state.errors, ...mapErrors(error?.responseJSON ?? {}, {})},
      });
      return false;
    }
  }

  function submitFromSelectedDashboard(widgetData: Widget) {
    if (!state.selectedDashboard) {
      return;
    }

    const queryData: QueryData = {
      queryNames: [],
      queryConditions: [],
      queryFields: [
        ...widgetData.queries[0].columns,
        ...widgetData.queries[0].aggregates,
      ],
      queryOrderby: widgetData.queries[0].orderby,
    };

    widgetData.queries.forEach(query => {
      queryData.queryNames.push(query.name);
      queryData.queryConditions.push(query.conditions);
    });

    const pathQuery = {
      displayType: widgetData.displayType,
      interval: widgetData.interval,
      title: widgetData.title,
      ...queryData,
      // Propagate page filters
      project: pageFilters.projects,
      environment: pageFilters.environments,
      ...omit(pageFilters.datetime, 'period'),
      statsPeriod: pageFilters.datetime?.period,
    };

    addSuccessMessage(t('Added widget.'));
    goToDashboards(state.selectedDashboard.value, pathQuery);
  }

  function goToDashboards(id: string, query?: Record<string, any>) {
    const pathQuery =
      !isEmpty(queryParamsWithoutSource) || query
        ? {
            ...queryParamsWithoutSource,
            ...query,
          }
        : undefined;

    if (id === NEW_DASHBOARD_ID) {
      router.push({
        pathname: `/organizations/${organization.slug}/dashboards/new/`,
        query: pathQuery,
      });
      return;
    }

    router.push({
      pathname: `/organizations/${organization.slug}/dashboard/${id}/`,
      query: pathQuery,
    });
  }

  function isFormInvalid() {
    if (notDashboardsOrigin && !state.selectedDashboard) {
      return true;
    }

    return false;
  }

  const canAddSearchConditions =
    [DisplayType.LINE, DisplayType.AREA, DisplayType.BAR].includes(state.displayType) &&
    state.queries.length < 3;

  const hideLegendAlias = [
    DisplayType.TABLE,
    DisplayType.WORLD_MAP,
    DisplayType.BIG_NUMBER,
  ].includes(state.displayType);

  // Tabular visualizations will always have only one query and that query cannot be deleted,
  // so we will always have the first query available to get data from.
  const {columns, aggregates, fields, fieldAliases = []} = state.queries[0];

  const explodedColumns = useMemo(() => {
    return columns.map((field, index) =>
      explodeField({field, alias: fieldAliases[index]})
    );
  }, [columns, fieldAliases]);

  const explodedAggregates = useMemo(() => {
    return aggregates.map((field, index) =>
      explodeField({field, alias: fieldAliases[index]})
    );
  }, [aggregates, fieldAliases]);

  const explodedFields = defined(fields)
    ? fields.map((field, index) => explodeField({field, alias: fieldAliases[index]}))
    : [...explodedColumns, ...explodedAggregates];

  const groupByValueSelected = currentWidget.queries.some(query => {
    const noEmptyColumns = query.columns.filter(column => !!column);
    return noEmptyColumns.length > 0;
  });

  // The SortBy field shall only be displayed in tabular visualizations or
  // on time-series visualizations when at least one groupBy value is selected
  const displaySortByStep =
    (widgetBuilderNewDesign && isTimeseriesChart && groupByValueSelected) ||
    isTabularChart;

  if (isEditing && !isValidWidgetIndex) {
    return (
      <SentryDocumentTitle title={dashboard.title} orgSlug={orgSlug}>
        <PageContent>
          <LoadingError message={t('The widget you want to edit was not found.')} />
        </PageContent>
      </SentryDocumentTitle>
    );
  }

  return (
    <SentryDocumentTitle title={dashboard.title} orgSlug={orgSlug}>
      <PageFiltersContainer
        skipLoadLastUsed={organization.features.includes('global-views')}
        defaultSelection={{
          datetime: {start: null, end: null, utc: false, period: DEFAULT_STATS_PERIOD},
        }}
        hideGlobalHeader
      >
        <PageContentWithoutPadding>
          <Header
            orgSlug={orgSlug}
            title={state.title}
            dashboardTitle={dashboard.title}
            goBackLocation={previousLocation}
            onChangeTitle={newTitle => {
              handleDisplayTypeOrTitleChange('title', newTitle);
            }}
          />
          <Body>
            <MainWrapper>
              <Main>
                <StyledPageFilterBar condensed>
                  <ProjectPageFilter />
                  <EnvironmentPageFilter />
                  <DatePageFilter alignDropdown="left" />
                </StyledPageFilterBar>
                <BuildSteps symbol="colored-numeric">
                  <VisualizationStep
                    widget={currentWidget}
                    organization={organization}
                    pageFilters={pageFilters}
                    displayType={state.displayType}
                    error={state.errors?.displayType}
                    onChange={newDisplayType => {
                      handleDisplayTypeOrTitleChange('displayType', newDisplayType);
                    }}
                  />
                  <DataSetStep
                    dataSet={state.dataSet}
                    displayType={state.displayType}
                    onChange={handleDataSetChange}
                    hasReleaseHealthFeature={hasReleaseHealthFeature}
                  />
                  {isTabularChart && (
                    <ColumnsStep
                      dataSet={state.dataSet}
                      queries={state.queries}
                      displayType={state.displayType}
                      widgetType={widgetType}
                      queryErrors={state.errors?.queries}
                      onQueryChange={handleQueryChange}
                      onYAxisOrColumnFieldChange={newFields => {
                        handleYAxisOrColumnFieldChange(newFields, true);
                      }}
                      explodedFields={explodedFields}
                      tags={tags}
                      organization={organization}
                    />
                  )}
                  {![DisplayType.TABLE].includes(state.displayType) && (
                    <YAxisStep
                      dataSet={state.dataSet}
                      displayType={state.displayType}
                      widgetType={widgetType}
                      queryErrors={state.errors?.queries}
                      onYAxisChange={newFields => {
                        handleYAxisOrColumnFieldChange(newFields);
                      }}
                      aggregates={explodedAggregates}
                      tags={tags}
                      organization={organization}
                    />
                  )}
                  <FilterResultsStep
                    queries={state.queries}
                    hideLegendAlias={hideLegendAlias}
                    canAddSearchConditions={canAddSearchConditions}
                    organization={organization}
                    queryErrors={state.errors?.queries}
                    onAddSearchConditions={handleAddSearchConditions}
                    onQueryChange={handleQueryChange}
                    onQueryRemove={handleQueryRemove}
                    selection={pageFilters}
                    widgetType={widgetType}
                  />
                  {widgetBuilderNewDesign && isTimeseriesChart && (
                    <GroupByStep
                      columns={columns
                        .filter(field => !(field === 'equation|'))
                        .map((field, index) =>
                          explodeField({field, alias: fieldAliases[index]})
                        )}
                      onGroupByChange={handleGroupByChange}
                      organization={organization}
                      tags={tags}
                      dataSet={state.dataSet}
                    />
                  )}
                  {displaySortByStep && (
                    <SortByStep
                      limit={state.limit}
                      displayType={state.displayType}
                      queries={state.queries}
                      dataSet={state.dataSet}
                      widgetBuilderNewDesign={widgetBuilderNewDesign}
                      error={state.errors?.orderby}
                      onSortByChange={handleSortByChange}
                      onLimitChange={handleLimitChange}
                      organization={organization}
                      widgetType={widgetType}
                      tags={tags}
                    />
                  )}
                  {notDashboardsOrigin && !widgetBuilderNewDesign && (
                    <DashboardStep
                      error={state.errors?.dashboard}
                      dashboards={state.dashboards}
                      onChange={selectedDashboard =>
                        setState({
                          ...state,
                          selectedDashboard,
                          errors: {...state.errors, dashboard: undefined},
                        })
                      }
                      disabled={state.loading}
                    />
                  )}
                </BuildSteps>
              </Main>
              <Footer
                goBackLocation={previousLocation}
                isEditing={isEditing}
                onSave={handleSave}
                onDelete={handleDelete}
                invalidForm={isFormInvalid()}
              />
            </MainWrapper>
            <Side>
              <WidgetLibrary
                widgetBuilderNewDesign={widgetBuilderNewDesign}
                onWidgetSelect={prebuiltWidget => {
                  setLatestLibrarySelectionTitle(prebuiltWidget.title);
                  setState({
                    ...state,
                    ...prebuiltWidget,
                    dataSet: prebuiltWidget.widgetType
                      ? WIDGET_TYPE_TO_DATA_SET[prebuiltWidget.widgetType]
                      : DataSet.EVENTS,
                    userHasModified: false,
                  });
                }}
                bypassOverwriteModal={!state.userHasModified}
              />
            </Side>
          </Body>
        </PageContentWithoutPadding>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

export default withPageFilters(withTags(WidgetBuilder));

const PageContentWithoutPadding = styled(PageContent)`
  padding: 0;
`;

const StyledPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(2)};
`;

const BuildSteps = styled(List)`
  gap: ${space(4)};
  max-width: 100%;
`;

const Body = styled(Layout.Body)`
  && {
    gap: 0;
    padding: 0;
  }

  grid-template-rows: 1fr;

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: minmax(100px, auto) 400px;
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: 1fr;
  }
`;

// HACK: Since we add 30px of padding to the ListItems
// there is 30px of overlap when the screen is just above 1200px.
// When we're up to 1230px (1200 + 30 to account for the padding)
// we decrease the width of ListItems by 30px
const Main = styled(Layout.Main)`
  max-width: 1000px;
  flex: 1;

  padding: ${space(4)} ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    padding: ${space(4)};
  }

  @media (max-width: calc(${p => p.theme.breakpoints[2]} + ${space(4)})) {
    ${ListItem} {
      width: calc(100% - ${space(4)});
    }
  }
`;

const Side = styled(Layout.Side)`
  padding: ${space(4)} ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    border-top: 1px solid ${p => p.theme.gray200};
    grid-row: 2/2;
    grid-column: 1/-1;
    max-width: 100%;
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    border-left: 1px solid ${p => p.theme.gray200};

    /* to be consistent with Layout.Body in other verticals */
    padding-right: ${space(4)};
    max-width: 400px;
  }
`;

const MainWrapper = styled('div')`
  display: flex;
  flex-direction: column;

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    grid-column: 1/-1;
  }
`;
