import {useEffect, useMemo, useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import isEmpty from 'lodash/isEmpty';
import omit from 'lodash/omit';
import set from 'lodash/set';

import {validateWidget} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import * as Layout from 'sentry/components/layouts/thirds';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import LoadingError from 'sentry/components/loadingError';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DateString, Organization, PageFilters, TagCollection} from 'sentry/types';
import {defined, objectIsEmpty} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {CustomMeasurementsProvider} from 'sentry/utils/customMeasurements/customMeasurementsProvider';
import EventView from 'sentry/utils/discover/eventView';
import {
  explodeField,
  generateFieldAsString,
  getColumnsAndAggregates,
  getColumnsAndAggregatesAsStrings,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import useApi from 'sentry/utils/useApi';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withPageFilters from 'sentry/utils/withPageFilters';
import withTags from 'sentry/utils/withTags';
import {
  assignTempId,
  enforceWidgetHeightValues,
  generateWidgetsAfterCompaction,
  getDefaultWidgetHeight,
} from 'sentry/views/dashboards/layoutUtils';
import {
  DashboardDetails,
  DashboardWidgetSource,
  DisplayType,
  Widget,
  WidgetQuery,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {MetricsDataSwitcher} from 'sentry/views/performance/landing/metricsDataSwitcher';

import {DEFAULT_STATS_PERIOD} from '../data';
import {getDatasetConfig} from '../datasetConfig/base';
import {
  DashboardsMEPConsumer,
  DashboardsMEPProvider,
} from '../widgetCard/dashboardsMEPContext';

import {ColumnsStep} from './buildSteps/columnsStep';
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
  generateOrderOptions,
  getIsTimeseriesChart,
  getParsedDefaultWidgetQuery,
  getResultsLimit,
  mapErrors,
  NEW_DASHBOARD_ID,
  normalizeQueries,
} from './utils';
import {WidgetLibrary} from './widgetLibrary';

const WIDGET_TYPE_TO_DATA_SET = {
  [WidgetType.DISCOVER]: DataSet.EVENTS,
  [WidgetType.ISSUE]: DataSet.ISSUES,
  [WidgetType.RELEASE]: DataSet.RELEASES,
};

export const DATA_SET_TO_WIDGET_TYPE = {
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
  dataSet: DataSet;
  displayType: Widget['displayType'];
  interval: Widget['interval'];
  limit: Widget['limit'];
  loading: boolean;
  prebuiltWidgetId: null | string;
  queries: Widget['queries'];
  queryConditionsValid: boolean;
  title: string;
  userHasModified: boolean;
  errors?: Record<string, any>;
  selectedDashboard?: DashboardDetails['id'];
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
  route,
  router,
  tags,
}: Props) {
  const {widgetIndex, orgId, dashboardId} = params;
  const {source, displayType, defaultTitle, limit} = location.query;
  const defaultWidgetQuery = getParsedDefaultWidgetQuery(
    location.query.defaultWidgetQuery
  );

  // defaultTableColumns can be a single string if location.query only contains
  // 1 value for this key. Ensure it is a string[]
  let {defaultTableColumns}: {defaultTableColumns: string[]} = location.query;
  if (typeof defaultTableColumns === 'string') {
    defaultTableColumns = [defaultTableColumns];
  }

  const isEditing = defined(widgetIndex);
  const widgetIndexNum = Number(widgetIndex);
  const isValidWidgetIndex =
    widgetIndexNum >= 0 &&
    widgetIndexNum < dashboard.widgets.length &&
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

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [datasetConfig, setDataSetConfig] = useState<ReturnType<typeof getDatasetConfig>>(
    getDatasetConfig(WidgetType.DISCOVER)
  );
  const [state, setState] = useState<State>(() => {
    const defaultState: State = {
      title: defaultTitle ?? t('Custom Widget'),
      displayType:
        (displayType === DisplayType.TOP_N ? DisplayType.AREA : displayType) ??
        DisplayType.TABLE,
      interval: '5m',
      queries: [],
      limit: limit ? Number(limit) : undefined,
      errors: undefined,
      loading: !!notDashboardsOrigin,
      userHasModified: false,
      prebuiltWidgetId: null,
      dataSet: DataSet.EVENTS,
      queryConditionsValid: true,
      selectedDashboard: dashboard.id || NEW_DASHBOARD_ID,
    };

    if (defaultWidgetQuery) {
      defaultState.queries = [
        {
          ...defaultWidgetQuery,
          orderby:
            defaultWidgetQuery.orderby ||
            (datasetConfig.getTableSortOptions
              ? datasetConfig.getTableSortOptions(organization, defaultWidgetQuery)[0]
                  .value
              : ''),
        },
      ];

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
      defaultState.queries = [{...datasetConfig.defaultWidgetQuery}];
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
      loadOrganizationTags(api, organization.slug, {
        ...selection,
        // Pin the request to 14d to avoid timeouts, see DD-967 for
        // more information
        datetime: {period: '14d', start: null, end: null, utc: null},
      });
    }

    if (isEditing && isValidWidgetIndex) {
      const widgetFromDashboard = dashboard.widgets[widgetIndexNum];

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
        });
      }

      setState({
        title: widgetFromDashboard.title,
        displayType: newDisplayType,
        interval: widgetFromDashboard.interval,
        queries,
        errors: undefined,
        loading: false,
        userHasModified: false,
        dataSet: widgetFromDashboard.widgetType
          ? WIDGET_TYPE_TO_DATA_SET[widgetFromDashboard.widgetType]
          : DataSet.EVENTS,
        limit: newLimit,
        prebuiltWidgetId: null,
        queryConditionsValid: true,
      });
      setDataSetConfig(getDatasetConfig(widgetFromDashboard.widgetType));
      setWidgetToBeUpdated(widgetFromDashboard);
    }
    // This should only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchOrgMembers(api, organization.slug, selection.projects?.map(String));
  }, [selection.projects, api, organization.slug]);

  useEffect(() => {
    const onUnload = () => {
      if (!isSubmitting && state.userHasModified) {
        return t('You have unsaved changes, are you sure you want to leave?');
      }
      return undefined;
    };

    router.setRouteLeaveHook(route, onUnload);
  }, [isSubmitting, state.userHasModified, route, router]);

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

  const currentDashboardId = state.selectedDashboard ?? dashboardId;
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

      if (!datasetConfig.supportedDisplayTypes.includes(newDisplayType)) {
        // Set to Events dataset if Display Type is not supported by
        // current dataset
        set(
          newState,
          'queries',
          normalizeQueries({
            displayType: newDisplayType,
            queries: [{...getDatasetConfig(WidgetType.DISCOVER).defaultWidgetQuery}],
            widgetType: WidgetType.DISCOVER,
          })
        );
        set(newState, 'dataSet', DataSet.EVENTS);
        setDataSetConfig(getDatasetConfig(WidgetType.DISCOVER));
        return {...newState, errors: undefined};
      }

      const normalized = normalizeQueries({
        displayType: newDisplayType,
        queries: prevState.queries,
        widgetType: DATA_SET_TO_WIDGET_TYPE[prevState.dataSet],
      });

      if (newDisplayType === DisplayType.TOP_N) {
        // TOP N display should only allow a single query
        normalized.splice(1);
      }

      if (!prevState.userHasModified) {
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

      set(newState, 'queries', normalized);

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

      set(newState, 'userHasModified', true);
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
      if (field === 'title') {
        set(newState, 'userHasModified', true);
      }
      return {...newState, errors: undefined};
    });

    if (field === 'displayType' && value !== state.displayType) {
      updateFieldsAccordingToDisplayType(value as DisplayType);
    }
  }

  function handleDataSetChange(newDataSet: string) {
    trackAdvancedAnalyticsEvent('dashboards_views.widget_builder.change', {
      from: source,
      field: 'dataSet',
      value: newDataSet,
      widget_type: widgetType,
      organization,
      new_widget: !isEditing,
    });
    setState(prevState => {
      const newState = cloneDeep(prevState);
      newState.queries.splice(0, newState.queries.length);
      set(newState, 'dataSet', newDataSet);

      if (newDataSet === DataSet.ISSUES) {
        set(newState, 'displayType', DisplayType.TABLE);
      }

      const config = getDatasetConfig(DATA_SET_TO_WIDGET_TYPE[newDataSet]);
      setDataSetConfig(config);

      newState.queries.push(
        ...(widgetToBeUpdated?.widgetType &&
        WIDGET_TYPE_TO_DATA_SET[widgetToBeUpdated.widgetType] === newDataSet
          ? widgetToBeUpdated.queries
          : [{...config.defaultWidgetQuery}])
      );

      set(newState, 'userHasModified', true);
      return {...newState, errors: undefined};
    });
  }

  function handleAddSearchConditions() {
    setState(prevState => {
      const newState = cloneDeep(prevState);
      const config = getDatasetConfig(DATA_SET_TO_WIDGET_TYPE[prevState.dataSet]);
      const query = cloneDeep(config.defaultWidgetQuery);
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
  function getHandleColumnFieldChange(isMetricsData?: boolean) {
    function handleColumnFieldChange(newFields: QueryFieldValue[]) {
      const fieldStrings = newFields.map(generateFieldAsString);
      const splitFields = getColumnsAndAggregatesAsStrings(newFields);
      const newState = cloneDeep(state);
      let newQuery = cloneDeep(newState.queries[0]);

      newQuery.fields = fieldStrings;
      newQuery.aggregates = splitFields.aggregates;
      newQuery.columns = splitFields.columns;
      newQuery.fieldAliases = splitFields.fieldAliases;

      if (datasetConfig.handleColumnFieldChangeOverride) {
        newQuery = datasetConfig.handleColumnFieldChangeOverride(newQuery);
      }

      if (datasetConfig.handleOrderByReset) {
        // If widget is metric backed, don't default to sorting by transaction unless its the only column
        // Sorting by transaction is not supported in metrics
        if (
          isMetricsData &&
          fieldStrings.some(
            fieldString => !['transaction', 'title'].includes(fieldString)
          )
        ) {
          newQuery = datasetConfig.handleOrderByReset(
            newQuery,
            fieldStrings.filter(
              fieldString => !['transaction', 'title'].includes(fieldString)
            )
          );
        } else {
          newQuery = datasetConfig.handleOrderByReset(newQuery, fieldStrings);
        }
      }

      set(newState, 'queries', [newQuery]);
      set(newState, 'userHasModified', true);
      setState(newState);
    }
    return handleColumnFieldChange;
  }

  function handleYAxisChange(newFields: QueryFieldValue[]) {
    const fieldStrings = newFields.map(generateFieldAsString);
    const newState = cloneDeep(state);

    const newQueries = state.queries.map(query => {
      let newQuery = cloneDeep(query);

      if (state.displayType === DisplayType.TOP_N) {
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

      if (datasetConfig.handleOrderByReset) {
        newQuery = datasetConfig.handleOrderByReset(newQuery, fieldStrings);
      }

      return newQuery;
    });

    set(newState, 'queries', newQueries);
    set(newState, 'userHasModified', true);

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

  function handleGroupByChange(newFields: QueryFieldValue[]) {
    const fieldStrings = newFields.map(generateFieldAsString);

    const newState = cloneDeep(state);

    const newQueries = state.queries.map(query => {
      const newQuery = cloneDeep(query);
      newQuery.columns = fieldStrings;

      if (!fieldStrings.length) {
        // The grouping was cleared, so clear the orderby
        newQuery.orderby = '';
      } else if (!newQuery.orderby) {
        const orderOptions = generateOrderOptions({
          widgetType: widgetType ?? WidgetType.DISCOVER,
          columns: query.columns,
          aggregates: query.aggregates,
        });
        let orderOption: string;
        // If no orderby options are available because of DISABLED_SORTS
        if (!orderOptions.length) {
          newQuery.orderby = '';
        } else {
          orderOption = orderOptions[0].value;
          newQuery.orderby = `-${orderOption}`;
        }
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

    setIsSubmitting(true);
    let nextWidgetList = [...dashboard.widgets];
    const updateWidgetIndex = getUpdateWidgetIndex();
    nextWidgetList.splice(updateWidgetIndex, 1);
    nextWidgetList = generateWidgetsAfterCompaction(nextWidgetList);

    onSave(nextWidgetList);
    router.push(normalizeUrl(previousLocation));
  }

  async function handleSave() {
    const widgetData: Widget = assignTempId(currentWidget);

    if (widgetToBeUpdated) {
      widgetData.layout = widgetToBeUpdated?.layout;
    }

    // Only Time Series charts shall have a limit
    if (!isTimeseriesChart) {
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

    setIsSubmitting(true);
    if (notDashboardsOrigin) {
      submitFromSelectedDashboard(widgetData);
      return;
    }

    if (widgetToBeUpdated) {
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
      addErrorMessage(t('Unable to save widget'));
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
    goToDashboards(state.selectedDashboard, pathQuery);
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
      router.push(
        normalizeUrl({
          pathname: `/organizations/${organization.slug}/dashboards/new/`,
          query: pathQuery,
        })
      );
      return;
    }

    router.push(
      normalizeUrl({
        pathname: `/organizations/${organization.slug}/dashboard/${id}/`,
        query: pathQuery,
      })
    );
  }

  function isFormInvalid() {
    if (
      (notDashboardsOrigin && !state.selectedDashboard) ||
      !state.queryConditionsValid
    ) {
      return true;
    }

    return false;
  }

  function setQueryConditionsValid(validSearch: boolean) {
    setState({...state, queryConditionsValid: validSearch});
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
  const displaySortByStep = (isTimeseriesChart && groupByValueSelected) || isTabularChart;

  if (isEditing && !isValidWidgetIndex) {
    return (
      <SentryDocumentTitle title={dashboard.title} orgSlug={orgSlug}>
        <Layout.Page withPadding>
          <LoadingError message={t('The widget you want to edit was not found.')} />
        </Layout.Page>
      </SentryDocumentTitle>
    );
  }

  return (
    <SentryDocumentTitle title={dashboard.title} orgSlug={orgSlug}>
      <PageFiltersContainer
        defaultSelection={{
          datetime: {start: null, end: null, utc: null, period: DEFAULT_STATS_PERIOD},
        }}
      >
        <CustomMeasurementsProvider organization={organization} selection={selection}>
          <DashboardsMEPProvider>
            <MetricsCardinalityProvider organization={organization} location={location}>
              <MetricsDataSwitcher
                organization={organization}
                eventView={EventView.fromLocation(location)}
                location={location}
                hideLoadingIndicator
              >
                {metricsDataSide => (
                  <MEPSettingProvider
                    location={location}
                    forceTransactions={metricsDataSide.forceTransactionsOnly}
                  >
                    <Layout.Page>
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
                                location={location}
                                widget={currentWidget}
                                dashboardFilters={dashboard.filters}
                                organization={organization}
                                pageFilters={pageFilters}
                                displayType={state.displayType}
                                error={state.errors?.displayType}
                                onChange={newDisplayType => {
                                  handleDisplayTypeOrTitleChange(
                                    'displayType',
                                    newDisplayType
                                  );
                                }}
                                noDashboardsMEPProvider
                                isWidgetInvalid={!state.queryConditionsValid}
                              />
                              <DataSetStep
                                dataSet={state.dataSet}
                                displayType={state.displayType}
                                onChange={handleDataSetChange}
                              />
                              {isTabularChart && (
                                <DashboardsMEPConsumer>
                                  {({isMetricsData}) => (
                                    <ColumnsStep
                                      dataSet={state.dataSet}
                                      queries={state.queries}
                                      displayType={state.displayType}
                                      widgetType={widgetType}
                                      queryErrors={state.errors?.queries}
                                      onQueryChange={handleQueryChange}
                                      handleColumnFieldChange={getHandleColumnFieldChange(
                                        isMetricsData
                                      )}
                                      explodedFields={explodedFields}
                                      tags={tags}
                                      organization={organization}
                                    />
                                  )}
                                </DashboardsMEPConsumer>
                              )}
                              {![DisplayType.TABLE].includes(state.displayType) && (
                                <YAxisStep
                                  dataSet={state.dataSet}
                                  displayType={state.displayType}
                                  widgetType={widgetType}
                                  queryErrors={state.errors?.queries}
                                  onYAxisChange={newFields => {
                                    handleYAxisChange(newFields);
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
                                dashboardFilters={dashboard.filters}
                                location={location}
                                onQueryConditionChange={setQueryConditionsValid}
                              />
                              {isTimeseriesChart && (
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
                                  error={state.errors?.orderby}
                                  onSortByChange={handleSortByChange}
                                  onLimitChange={handleLimitChange}
                                  organization={organization}
                                  widgetType={widgetType}
                                  tags={tags}
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
                            organization={organization}
                            selectedWidgetId={
                              state.userHasModified ? null : state.prebuiltWidgetId
                            }
                            onWidgetSelect={prebuiltWidget => {
                              setLatestLibrarySelectionTitle(prebuiltWidget.title);
                              setDataSetConfig(
                                getDatasetConfig(
                                  prebuiltWidget.widgetType || WidgetType.DISCOVER
                                )
                              );
                              const {id, ...prebuiltWidgetProps} = prebuiltWidget;
                              setState({
                                ...state,
                                ...prebuiltWidgetProps,
                                dataSet: prebuiltWidget.widgetType
                                  ? WIDGET_TYPE_TO_DATA_SET[prebuiltWidget.widgetType]
                                  : DataSet.EVENTS,
                                userHasModified: false,
                                prebuiltWidgetId: id || null,
                              });
                            }}
                            bypassOverwriteModal={!state.userHasModified}
                          />
                        </Side>
                      </Body>
                    </Layout.Page>
                  </MEPSettingProvider>
                )}
              </MetricsDataSwitcher>
            </MetricsCardinalityProvider>
          </DashboardsMEPProvider>
        </CustomMeasurementsProvider>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

export default withPageFilters(withTags(WidgetBuilder));

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

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: minmax(100px, auto) 400px;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
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

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(4)};
  }

  @media (max-width: calc(${p => p.theme.breakpoints.large} + ${space(4)})) {
    ${ListItem} {
      width: calc(100% - ${space(4)});
    }
  }
`;

const Side = styled(Layout.Side)`
  padding: ${space(4)} ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.large}) {
    border-top: 1px solid ${p => p.theme.gray200};
    grid-row: 2/2;
    grid-column: 1/-1;
    max-width: 100%;
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    border-left: 1px solid ${p => p.theme.gray200};

    /* to be consistent with Layout.Body in other verticals */
    padding-right: ${space(4)};
    max-width: 400px;
  }
`;

const MainWrapper = styled('div')`
  display: flex;
  flex-direction: column;

  @media (max-width: ${p => p.theme.breakpoints.large}) {
    grid-column: 1/-1;
  }
`;
