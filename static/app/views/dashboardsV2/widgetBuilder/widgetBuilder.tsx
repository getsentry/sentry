import {useEffect, useMemo, useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import isEmpty from 'lodash/isEmpty';
import omit from 'lodash/omit';
import set from 'lodash/set';

import {validateWidget} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {generateOrderOptions} from 'sentry/components/dashboards/widgetQueriesForm';
import * as Layout from 'sentry/components/layouts/thirds';
import List from 'sentry/components/list';
import LoadingError from 'sentry/components/loadingError';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {
  DateString,
  Organization,
  PageFilters,
  SelectValue,
  TagCollection,
} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {
  explodeField,
  generateFieldAsString,
  getAggregateAlias,
  getColumnsAndAggregates,
  getColumnsAndAggregatesAsStrings,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import {SessionMetric} from 'sentry/utils/metrics/fields';
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
  getParsedDefaultWidgetQuery,
  mapErrors,
  normalizeQueries,
} from './utils';
import {WidgetLibrary} from './widgetLibrary';

// Both dashboards and widgets use the 'new' keyword when creating
const NEW_DASHBOARD_ID = 'new';

function getDataSetQuery(widgetBuilderNewDesign: boolean): Record<DataSet, WidgetQuery> {
  return {
    [DataSet.EVENTS]: {
      name: '',
      fields: ['count()'],
      columns: [],
      fieldAliases: [],
      aggregates: ['count()'],
      conditions: '',
      orderby: widgetBuilderNewDesign ? '-count' : '',
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
    [DataSet.METRICS]: {
      name: '',
      fields: [`sum(${SessionMetric.SESSION})`],
      columns: [],
      fieldAliases: [],
      aggregates: [`sum(${SessionMetric.SESSION})`],
      conditions: '',
      orderby: '',
    },
  };
}

const WIDGET_TYPE_TO_DATA_SET = {
  [WidgetType.DISCOVER]: DataSet.EVENTS,
  [WidgetType.ISSUE]: DataSet.ISSUES,
  // [WidgetType.METRICS]: DataSet.METRICS,
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

  const isEditing = defined(widgetIndex);
  const widgetIndexNum = Number(widgetIndex);
  const isValidWidgetIndex =
    widgetIndexNum >= 0 &&
    widgetIndexNum < dashboard.widgets.length &&
    Number.isInteger(widgetIndexNum);
  const orgSlug = organization.slug;

  // Feature flag for new widget builder design. This feature is still a work in progress and not yet available internally.
  const widgetBuilderNewDesign = organization.features.includes(
    'new-widget-builder-experience-design'
  );

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
    return {
      title: defaultTitle ?? t('Custom Widget'),
      displayType: displayType ?? DisplayType.TABLE,
      interval: '5m',
      queries: [
        defaultWidgetQuery
          ? widgetBuilderNewDesign
            ? {
                ...defaultWidgetQuery,
                orderby:
                  defaultWidgetQuery.orderby ||
                  generateOrderOptions({
                    widgetType: WidgetType.DISCOVER,
                    widgetBuilderNewDesign,
                    columns: defaultWidgetQuery.columns,
                    aggregates: defaultWidgetQuery.aggregates,
                  })[0].value,
              }
            : {...defaultWidgetQuery}
          : {...getDataSetQuery(widgetBuilderNewDesign)[DataSet.EVENTS]},
      ],
      limit,
      errors: undefined,
      loading: !!notDashboardsOrigin,
      dashboards: [],
      userHasModified: false,
      dataSet: DataSet.EVENTS,
    };
  });
  const [widgetToBeUpdated, setWidgetToBeUpdated] = useState<Widget | null>(null);

  useEffect(() => {
    if (notDashboardsOrigin) {
      fetchDashboards();
    }
  }, [source]);

  useEffect(() => {
    if (isEditing && isValidWidgetIndex) {
      const widgetFromDashboard = dashboard.widgets[widgetIndexNum];
      const visualization =
        widgetBuilderNewDesign && widgetFromDashboard.displayType === DisplayType.TOP_N
          ? DisplayType.TABLE
          : widgetFromDashboard.displayType;
      setState({
        title: widgetFromDashboard.title,
        displayType: visualization,
        interval: widgetFromDashboard.interval,
        queries: normalizeQueries({
          displayType: visualization,
          queries: widgetFromDashboard.queries,
          widgetType: widgetFromDashboard.widgetType ?? WidgetType.DISCOVER,
          widgetBuilderNewDesign,
        }),
        errors: undefined,
        loading: false,
        dashboards: [],
        userHasModified: false,
        dataSet: widgetFromDashboard.widgetType
          ? WIDGET_TYPE_TO_DATA_SET[widgetFromDashboard.widgetType]
          : DataSet.EVENTS,
        limit: widgetFromDashboard.limit,
      });
      setWidgetToBeUpdated(widgetFromDashboard);
    }
  }, []);

  const widgetType =
    state.dataSet === DataSet.EVENTS
      ? WidgetType.DISCOVER
      : state.dataSet === DataSet.ISSUES
      ? WidgetType.ISSUE
      : WidgetType.METRICS;

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
      currentDashboardId === NEW_DASHBOARD_ID
        ? `/organizations/${orgId}/dashboards/new/`
        : `/organizations/${orgId}/dashboard/${currentDashboardId}/`,
    query: isEmpty(queryParamsWithoutSource) ? undefined : queryParamsWithoutSource,
  };

  const isTimeseriesChart = [
    DisplayType.LINE,
    DisplayType.BAR,
    DisplayType.AREA,
  ].includes(state.displayType);

  const isTabularChart = [DisplayType.TABLE, DisplayType.TOP_N].includes(
    state.displayType
  );

  function updateFieldsAccordingToDisplayType(newDisplayType: DisplayType) {
    setState(prevState => {
      const newState = cloneDeep(prevState);
      const normalized = normalizeQueries({
        displayType: newDisplayType,
        queries: prevState.queries,
        widgetType:
          prevState.dataSet === DataSet.EVENTS ? WidgetType.DISCOVER : WidgetType.ISSUE,
        widgetBuilderNewDesign,
      });

      if (newDisplayType === DisplayType.TOP_N) {
        // TOP N display should only allow a single query
        normalized.splice(1);
      }

      if (widgetBuilderNewDesign && !isTabularChart && !isTimeseriesChart) {
        newState.limit = undefined;
      }

      if (
        prevState.displayType === DisplayType.TABLE &&
        widgetToBeUpdated?.widgetType &&
        WIDGET_TYPE_TO_DATA_SET[widgetToBeUpdated.widgetType] === DataSet.ISSUES
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
              if (!!defaultWidgetQuery.orderby) {
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

      return {...newState, errors: undefined};
    });
  }

  function handleDisplayTypeOrTitleChange<
    F extends keyof Pick<State, 'displayType' | 'title'>
  >(field: F, value: State[F]) {
    trackAdvancedAnalyticsEvent('dashboards_views.add_widget_in_builder.change', {
      from: source,
      field,
      value,
      widget_type: widgetType,
      organization,
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
      const query = cloneDeep(getDataSetQuery(widgetBuilderNewDesign)[DataSet.EVENTS]);
      query.fields = prevState.queries[0].fields;
      query.aggregates = prevState.queries[0].aggregates;
      query.columns = prevState.queries[0].columns;
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

      if (widgetBuilderNewDesign && isTimeseriesChart && queryIndex === 0) {
        const groupByFields = newQuery.columns.filter(field => !(field === 'equation|'));

        if (groupByFields.length === 0) {
          set(newState, 'limit', undefined);
        } else {
          set(newState, 'limit', newState.limit ?? DEFAULT_RESULTS_LIMIT);
        }
      }
      return {...newState, errors: undefined};
    });
  }

  function handleYAxisOrColumnFieldChange(
    newFields: QueryFieldValue[],
    isColumn = false
  ) {
    const fieldStrings = newFields.map(generateFieldAsString);
    const aggregateAliasFieldStrings = fieldStrings.map(getAggregateAlias);

    const columnsAndAggregates = isColumn
      ? getColumnsAndAggregatesAsStrings(newFields)
      : undefined;

    const newState = cloneDeep(state);

    for (const index in state.queries) {
      const queryIndex = Number(index);
      const query = state.queries[queryIndex];

      const descending = query.orderby.startsWith('-');
      const orderbyAggregateAliasField = query.orderby.replace('-', '');
      const prevAggregateAliasFieldStrings = query.aggregates.map(getAggregateAlias);
      const newQuery = cloneDeep(query);

      if (isColumn) {
        newQuery.fields = fieldStrings;
        newQuery.aggregates = columnsAndAggregates?.aggregates ?? [];
      } else {
        newQuery.fields = [...newQuery.columns, ...fieldStrings];
        newQuery.aggregates = fieldStrings;
      }

      if (!(widgetBuilderNewDesign && isTimeseriesChart) && isColumn) {
        // Prevent overwriting columns when setting y-axis for time series
        newQuery.columns = columnsAndAggregates?.columns ?? [];
      }

      if (
        !aggregateAliasFieldStrings.includes(orderbyAggregateAliasField) &&
        query.orderby !== ''
      ) {
        if (prevAggregateAliasFieldStrings.length === newFields.length) {
          // The Field that was used in orderby has changed. Get the new field.
          const newOrderByValue =
            aggregateAliasFieldStrings[
              prevAggregateAliasFieldStrings.indexOf(orderbyAggregateAliasField)
            ];

          if (descending) {
            newQuery.orderby = `-${newOrderByValue}`;
          } else {
            newQuery.orderby = newOrderByValue;
          }
        } else {
          newQuery.orderby = widgetBuilderNewDesign ? aggregateAliasFieldStrings[0] : '';
        }
      }

      if (widgetBuilderNewDesign) {
        newQuery.fieldAliases = columnsAndAggregates?.fieldAliases ?? [];

        if (queryIndex === 0) {
          newQuery.orderby = aggregateAliasFieldStrings[0];
        }
      }

      set(newState, `queries.${queryIndex}`, newQuery);
    }

    set(newState, 'userHasModified', true);

    if (widgetBuilderNewDesign && isTimeseriesChart) {
      const groupByFields = newState.queries[0].columns.filter(
        field => !(field === 'equation|')
      );
      if (groupByFields.length === 0) {
        set(newState, 'limit', undefined);
      } else {
        set(newState, 'limit', newState.limit ?? DEFAULT_RESULTS_LIMIT);
      }
    }

    setState(newState);
  }

  function handleGroupByChange(newFields: QueryFieldValue[]) {
    const fieldStrings = newFields.map(generateFieldAsString);

    const newState = cloneDeep(state);

    state.queries.forEach((query, index) => {
      const newQuery = cloneDeep(query);
      newQuery.columns = fieldStrings;
      set(newState, `queries.${index}`, newQuery);
    });

    set(newState, 'userHasModified', true);

    if (widgetBuilderNewDesign && isTimeseriesChart) {
      const groupByFields = newState.queries[0].columns.filter(
        field => !(field === 'equation|')
      );
      if (groupByFields.length === 0) {
        set(newState, 'limit', undefined);
      } else {
        set(newState, 'limit', newState.limit ?? DEFAULT_RESULTS_LIMIT);
      }
    }

    setState(newState);
  }

  function handleLimitChange(newLimit: number) {
    setState({...state, limit: newLimit});
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
    nextWidgetList.splice(widgetIndexNum, 1);
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

    if (notDashboardsOrigin) {
      submitFromSelectedDashboard(widgetData);
      return;
    }

    if (!!widgetToBeUpdated) {
      let nextWidgetList = [...dashboard.widgets];
      const updateIndex = nextWidgetList.indexOf(widgetToBeUpdated);
      const nextWidgetData = {...widgetData, id: widgetToBeUpdated.id};

      // Only modify and re-compact if the default height has changed
      if (
        getDefaultWidgetHeight(widgetToBeUpdated.displayType) !==
        getDefaultWidgetHeight(widgetData.displayType)
      ) {
        nextWidgetList[updateIndex] = enforceWidgetHeightValues(nextWidgetData);
        nextWidgetList = generateWidgetsAfterCompaction(nextWidgetList);
      } else {
        nextWidgetList[updateIndex] = nextWidgetData;
      }

      onSave(nextWidgetList);
      addSuccessMessage(t('Updated widget.'));
      goToDashboards(dashboardId ?? NEW_DASHBOARD_ID);
      trackAdvancedAnalyticsEvent('dashboards_views.edit_widget_in_builder.confirm', {
        organization,
      });
      return;
    }

    onSave([...dashboard.widgets, widgetData]);
    addSuccessMessage(t('Added widget.'));
    goToDashboards(dashboardId ?? NEW_DASHBOARD_ID);
    trackAdvancedAnalyticsEvent('dashboards_views.add_widget_in_builder.confirm', {
      organization,
      data_set: widgetData.widgetType ?? WidgetType.DISCOVER,
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
      setState({...state, dashboards, loading: false});
    } catch (error) {
      const errorMessage = t('Unable to fetch dashboards');
      addErrorMessage(errorMessage);
      handleXhrErrorResponse(errorMessage)(error);
      setState({...state, loading: false});
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

  if (isEditing && !isValidWidgetIndex) {
    return (
      <SentryDocumentTitle title={dashboard.title} orgSlug={orgSlug}>
        <PageContent>
          <LoadingError message={t('The widget you want to edit was not found.')} />
        </PageContent>
      </SentryDocumentTitle>
    );
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
  }, []);

  const explodedAggregates = useMemo(() => {
    return aggregates.map((field, index) =>
      explodeField({field, alias: fieldAliases[index]})
    );
  }, []);

  const explodedFields = defined(fields)
    ? fields.map((field, index) => explodeField({field, alias: fieldAliases[index]}))
    : [...explodedColumns, ...explodedAggregates];

  return (
    <SentryDocumentTitle title={dashboard.title} orgSlug={orgSlug}>
      <PageFiltersContainer
        skipLoadLastUsed={organization.features.includes('global-views')}
        defaultSelection={{
          datetime: {start: null, end: null, utc: false, period: DEFAULT_STATS_PERIOD},
        }}
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
                    widgetBuilderNewDesign={widgetBuilderNewDesign}
                  />
                  <DataSetStep
                    dataSet={state.dataSet}
                    displayType={state.displayType}
                    onChange={handleDataSetChange}
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
                      explodedColumns={explodedColumns}
                      explodedAggregates={explodedAggregates}
                      tags={tags}
                      organization={organization}
                    />
                  )}
                  {![DisplayType.TABLE].includes(state.displayType) && (
                    <YAxisStep
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
                    />
                  )}
                  {((widgetBuilderNewDesign && isTimeseriesChart) || isTabularChart) && (
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
                    />
                  )}
                  {notDashboardsOrigin && (
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
                onWidgetSelect={prebuiltWidget =>
                  setState({
                    ...state,
                    ...prebuiltWidget,
                    dataSet: prebuiltWidget.widgetType
                      ? WIDGET_TYPE_TO_DATA_SET[prebuiltWidget.widgetType]
                      : DataSet.EVENTS,
                    userHasModified: false,
                  })
                }
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

const BuildSteps = styled(List)`
  gap: ${space(4)};
  max-width: 100%;
`;

const Body = styled(Layout.Body)`
  grid-template-rows: 1fr;
  && {
    gap: 0;
    padding: 0;
  }

  @media (max-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: 1fr;
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    /* 325px + 16px + 16px to match Side component width, padding-left and padding-right */
    grid-template-columns: minmax(100px, auto) calc(325px + ${space(2) + space(2)});
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    /* 325px + 16px + 30px to match Side component width, padding-left and padding-right */
    grid-template-columns: minmax(100px, auto) calc(325px + ${space(2) + space(4)});
  }
`;

const Main = styled(Layout.Main)`
  max-width: 1000px;
  flex: 1;

  padding: ${space(4)} ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    padding: ${space(4)};
  }
`;

const Side = styled(Layout.Side)`
  padding: ${space(4)} ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    border-left: 1px solid ${p => p.theme.gray200};

    /* to be consistent with Layout.Body in other verticals */
    padding-right: ${space(4)};
  }

  @media (max-width: ${p => p.theme.breakpoints[3]}) {
    border-top: 1px solid ${p => p.theme.gray200};
  }

  @media (max-width: ${p => p.theme.breakpoints[3]}) {
    grid-row: 2/2;
    grid-column: 1/1;
  }
`;

const MainWrapper = styled('div')`
  display: flex;
  flex-direction: column;
`;
