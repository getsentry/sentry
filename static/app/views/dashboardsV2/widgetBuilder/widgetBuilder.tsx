import {useEffect, useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import set from 'lodash/set';

import {validateWidget} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Button from 'sentry/components/button';
import {generateOrderOptions} from 'sentry/components/dashboards/widgetQueriesForm';
import SearchBar from 'sentry/components/events/searchBar';
import Input from 'sentry/components/forms/controls/input';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import Field from 'sentry/components/forms/field';
import SelectControl from 'sentry/components/forms/selectControl';
import * as Layout from 'sentry/components/layouts/thirds';
import List from 'sentry/components/list';
import LoadingError from 'sentry/components/loadingError';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PanelAlert} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {IconAdd, IconDelete} from 'sentry/icons';
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
import {
  explodeField,
  generateFieldAsString,
  getAggregateAlias,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import Measurements, {
  MeasurementCollection,
} from 'sentry/utils/measurements/measurements';
import {SPAN_OP_BREAKDOWN_FIELDS} from 'sentry/utils/performance/spanOperationBreakdowns/constants';
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
  Widget,
  WidgetQuery,
  WidgetType,
} from 'sentry/views/dashboardsV2/types';
import {
  generateIssueWidgetFieldOptions,
  generateIssueWidgetOrderOptions,
} from 'sentry/views/dashboardsV2/widgetBuilder/issueWidget/utils';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

import {DEFAULT_STATS_PERIOD} from '../data';
import WidgetCard from '../widgetCard';

import BuildStep from './buildStep';
import {ColumnFields} from './columnFields';
import {DashboardSelector} from './dashboardSelector';
import {Header} from './header';
import {
  DataSet,
  DisplayType,
  displayTypes,
  FlatValidationError,
  mapErrors,
  normalizeQueries,
} from './utils';
import {YAxisSelector} from './yAxisSelector';

const DATASET_CHOICES: [DataSet, string][] = [
  [DataSet.EVENTS, t('All Events (Errors and Transactions)')],
  [DataSet.ISSUES, t('Issues (States, Assignment, Time, etc.)')],
  // [DataSet.METRICS, t('Metrics (Release Health)')],
];

const DISPLAY_TYPES_OPTIONS = Object.keys(displayTypes).map(value => ({
  label: displayTypes[value],
  value,
}));

const QUERIES = {
  [DataSet.EVENTS]: {
    name: '',
    fields: ['count()'],
    conditions: '',
    orderby: '',
  },
  [DataSet.ISSUES]: {
    name: '',
    fields: ['issue', 'assignee', 'title'] as string[],
    conditions: '',
    orderby: '',
  },
  // [DataSet.METRICS]: {
  //   name: '',
  //   fields: [SessionMetric.SENTRY_SESSIONS_SESSION],
  //   conditions: '',
  //   orderby: '',
  // },
};

const WIDGET_TYPE_TO_DATA_SET = {
  [WidgetType.DISCOVER]: DataSet.EVENTS,
  [WidgetType.ISSUE]: DataSet.ISSUES,
  // [WidgetType.METRICS]: DataSet.METRICS,
};

type RouteParams = {
  orgId: string;
  dashboardId?: string;
  widgetId?: number;
};

type QueryData = {
  queryConditions: string[];
  queryFields: string[];
  queryNames: string[];
  queryOrderby: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  dashboard: DashboardDetails;
  onSave: (widgets: Widget[]) => void;
  organization: Organization;
  selection: PageFilters;
  tags: TagCollection;
  defaultTableColumns?: readonly string[];
  defaultTitle?: string;
  defaultWidgetQuery?: WidgetQuery;
  displayType?: DisplayType;
  end?: DateString;
  start?: DateString;
  statsPeriod?: string | null;
  widget?: Widget;
};

type State = {
  dashboards: DashboardListItem[];
  dataSet: DataSet;
  displayType: Widget['displayType'];
  interval: Widget['interval'];
  loading: boolean;
  queries: Widget['queries'];
  title: string;
  userHasModified: boolean;
  errors?: Record<string, any>;
  selectedDashboard?: SelectValue<string>;
};

function WidgetBuilder({
  dashboard,
  widget: widgetToBeUpdated,
  params,
  location,
  organization,
  selection,
  start,
  end,
  statsPeriod,
  defaultWidgetQuery,
  displayType,
  defaultTitle,
  defaultTableColumns,
  tags,
  onSave,
  router,
}: Props) {
  const {widgetId, orgId, dashboardId} = params;
  const {source} = location.query;

  const isEditing = defined(widgetId);
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
    if (!widgetToBeUpdated) {
      return {
        title: defaultTitle ?? t('Custom Widget'),
        displayType: displayType ?? DisplayType.TABLE,
        interval: '5m',
        queries: [defaultWidgetQuery ? {...defaultWidgetQuery} : {...QUERIES.events}],
        errors: undefined,
        loading: !!notDashboardsOrigin,
        dashboards: [],
        userHasModified: false,
        dataSet: DataSet.EVENTS,
      };
    }

    return {
      title: widgetToBeUpdated.title,
      displayType: widgetToBeUpdated.displayType,
      interval: widgetToBeUpdated.interval,
      queries: normalizeQueries(widgetToBeUpdated.displayType, widgetToBeUpdated.queries),
      errors: undefined,
      loading: false,
      dashboards: [],
      userHasModified: false,
      dataSet: widgetToBeUpdated.widgetType
        ? WIDGET_TYPE_TO_DATA_SET[widgetToBeUpdated.widgetType]
        : DataSet.EVENTS,
    };
  });

  const [blurTimeout, setBlurTimeout] = useState<null | number>(null);

  useEffect(() => {
    if (!notDashboardsOrigin) {
      defaultFields();
    }
  }, [state.displayType]);

  useEffect(() => {
    if (notDashboardsOrigin) {
      fetchDashboards();
    }
  }, [source]);

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
    widgetType,
  };

  const currentDashboardId = state.selectedDashboard?.value ?? dashboardId;
  const previousLocation = {
    pathname: currentDashboardId
      ? `/organizations/${orgId}/dashboard/${currentDashboardId}/`
      : `/organizations/${orgId}/dashboards/new/`,
    query: {...location.query},
  };

  function defaultFields() {
    setState(prevState => {
      const newState = cloneDeep(prevState);
      const normalized = normalizeQueries(prevState.displayType, prevState.queries);

      if (prevState.displayType === DisplayType.TOP_N) {
        // TOP N display should only allow a single query
        normalized.splice(1);
      }

      if (!prevState.userHasModified) {
        // If the Widget is an issue widget,
        if (
          prevState.displayType === DisplayType.TABLE &&
          widgetToBeUpdated?.widgetType &&
          WIDGET_TYPE_TO_DATA_SET[widgetToBeUpdated.widgetType] === DataSet.ISSUES
        ) {
          set(newState, 'queries', widgetToBeUpdated.queries);
          set(newState, 'dataSet', DataSet.ISSUES);
          return {...newState, errors: undefined};
        }

        // Default widget provided by Add to Dashboard from Discover
        if (defaultWidgetQuery && defaultTableColumns) {
          // If switching to Table visualization, use saved query fields for Y-Axis if user has not made query changes
          // This is so the widget can reflect the same columns as the table in Discover without requiring additional user input
          if (prevState.displayType === DisplayType.TABLE) {
            normalized.forEach(query => {
              query.fields = [...defaultTableColumns];
            });
          } else if (prevState.displayType === displayType) {
            // When switching back to original display type, default fields back to the fields provided from the discover query
            normalized.forEach(query => {
              query.fields = [...defaultWidgetQuery.fields];
              query.orderby = defaultWidgetQuery.orderby;
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
          : [QUERIES[newDataSet]])
      );

      set(newState, 'userHasModified', true);
      return {...newState, errors: undefined};
    });
  }

  function handleAddSearchConditions() {
    setState(prevState => {
      const newState = cloneDeep(prevState);
      const query = cloneDeep(QUERIES.events);
      query.fields = prevState.queries[0].fields;
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

  function handleYAxisOrColumnFieldChange(newFields: QueryFieldValue[]) {
    const fieldStrings = newFields.map(generateFieldAsString);
    const aggregateAliasFieldStrings = fieldStrings.map(getAggregateAlias);

    for (const index in state.queries) {
      const queryIndex = Number(index);
      const query = state.queries[queryIndex];

      const descending = query.orderby.startsWith('-');
      const orderbyAggregateAliasField = query.orderby.replace('-', '');
      const prevAggregateAliasFieldStrings = query.fields.map(getAggregateAlias);
      const newQuery = cloneDeep(query);
      newQuery.fields = fieldStrings;
      if (
        !aggregateAliasFieldStrings.includes(orderbyAggregateAliasField) &&
        query.orderby !== ''
      ) {
        if (prevAggregateAliasFieldStrings.length === newFields.length) {
          // The Field that was used in orderby has changed. Get the new field.
          newQuery.orderby = `${descending && '-'}${
            aggregateAliasFieldStrings[
              prevAggregateAliasFieldStrings.indexOf(orderbyAggregateAliasField)
            ]
          }`;
        } else {
          newQuery.orderby = '';
        }
      }

      handleQueryChange(queryIndex, newQuery);
    }
  }

  async function handleSave() {
    setState({...state, loading: true});

    const widgetData: Widget = assignTempId(currentWidget);

    if (widgetToBeUpdated) {
      widgetData.layout = widgetToBeUpdated?.layout;
    }

    // Only Table and Top N views need orderby
    if (![DisplayType.TABLE, DisplayType.TOP_N].includes(widgetData.displayType)) {
      widgetData.queries.forEach(query => {
        query.orderby = '';
      });
    }

    let errors: FlatValidationError = {};

    try {
      await validateWidget(api, organization.slug, widgetData);

      if (!!widgetToBeUpdated) {
        updateWidget(widgetToBeUpdated, widgetData);
        return;
      }

      onSave([...dashboard.widgets, widgetData]);
      addSuccessMessage(t('Added widget.'));
    } catch (err) {
      errors = mapErrors(err?.responseJSON ?? {}, {});
    } finally {
      setState({...state, errors, loading: false});

      if (notDashboardsOrigin) {
        submitFromSelectedDashboard(errors, widgetData);
        return;
      }

      goBack();
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

  function submitFromSelectedDashboard(errors: FlatValidationError, widgetData: Widget) {
    // Validate that a dashboard was selected since api call to /dashboards/widgets/ does not check for dashboard
    if (
      !state.selectedDashboard ||
      !(
        state.dashboards.find(({title, id}) => {
          return (
            title === state.selectedDashboard?.label &&
            id === state.selectedDashboard?.value
          );
        }) || state.selectedDashboard.value === 'new'
      )
    ) {
      errors.dashboard = t('This field may not be blank');
      setState({...state, errors});
    }

    if (!Object.keys(errors).length && state.selectedDashboard) {
      const queryData: QueryData = {
        queryNames: [],
        queryConditions: [],
        queryFields: widgetData.queries[0].fields,
        queryOrderby: widgetData.queries[0].orderby,
      };

      widgetData.queries.forEach(query => {
        queryData.queryNames.push(query.name);
        queryData.queryConditions.push(query.conditions);
      });

      const query = {
        displayType: widgetData.displayType,
        interval: widgetData.interval,
        title: widgetData.title,
        ...(queryData ?? {}),
      };

      goBack(query);
    }
  }

  function updateWidget(prevWidget: Widget, nextWidget: Widget) {
    let nextWidgetList = [...dashboard.widgets];
    const updateIndex = nextWidgetList.indexOf(prevWidget);
    const nextWidgetData = {...nextWidget, id: prevWidget.id};

    // Only modify and re-compact if the default height has changed
    if (
      getDefaultWidgetHeight(prevWidget.displayType) !==
      getDefaultWidgetHeight(nextWidget.displayType)
    ) {
      nextWidgetList[updateIndex] = enforceWidgetHeightValues(nextWidgetData);
      nextWidgetList = generateWidgetsAfterCompaction(nextWidgetList);
    } else {
      nextWidgetList[updateIndex] = nextWidgetData;
    }

    onSave(nextWidgetList);
    addSuccessMessage(t('Updated widget.'));
  }

  function getAmendedFieldOptions(measurements: MeasurementCollection) {
    return generateFieldOptions({
      organization,
      tagKeys: Object.values(tags).map(({key}) => key),
      measurementKeys: Object.values(measurements).map(({key}) => key),
      spanOperationBreakdownKeys: SPAN_OP_BREAKDOWN_FIELDS,
    });
  }

  function goBack(query?: Record<string, any>) {
    if (query) {
      previousLocation.query = {...previousLocation.query, ...query};
    }

    router.push(previousLocation);
  }

  if (isEditing && !dashboard.widgets.some(({id}) => id === String(widgetId))) {
    return (
      <SentryDocumentTitle title={dashboard.title} orgSlug={orgSlug}>
        <PageContent>
          <LoadingError message={t('The widget you want to edit was not found.')} />
        </PageContent>
      </SentryDocumentTitle>
    );
  }

  const canAddSearchConditions =
    [
      DisplayType.LINE,
      DisplayType.AREA,
      DisplayType.STACKED_AREA,
      DisplayType.BAR,
    ].includes(state.displayType) && state.queries.length < 3;

  const hideLegendAlias = [
    DisplayType.TABLE,
    DisplayType.WORLD_MAP,
    DisplayType.BIG_NUMBER,
  ].includes(state.displayType);

  const explodedFields = state.queries[0].fields.map(field => explodeField({field}));

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
            isEditing={isEditing}
            onChangeTitle={newTitle => setState({...state, title: newTitle})}
            onSave={handleSave}
          />
          <Layout.Body>
            <BuildSteps symbol="colored-numeric">
              <BuildStep
                title={t('Choose your visualization')}
                description={t(
                  'This is a preview of how your widget will appear in the dashboard.'
                )}
              >
                <VisualizationWrapper>
                  <DisplayTypeOptions
                    name="displayType"
                    options={DISPLAY_TYPES_OPTIONS}
                    value={state.displayType}
                    onChange={(option: {label: string; value: DisplayType}) => {
                      setState({...state, displayType: option.value});
                    }}
                  />
                  <WidgetCard
                    organization={organization}
                    selection={pageFilters}
                    widget={currentWidget}
                    isEditing={false}
                    widgetLimitReached={false}
                    renderErrorMessage={errorMessage =>
                      typeof errorMessage === 'string' && (
                        <PanelAlert type="error">{errorMessage}</PanelAlert>
                      )
                    }
                    isSorting={false}
                    currentWidgetDragging={false}
                    noLazyLoad
                  />
                </VisualizationWrapper>
              </BuildStep>
              <BuildStep
                title={t('Choose your data set')}
                description={t(
                  'Monitor specific events such as errors and transactions or metrics based on Release Health.'
                )}
              >
                <DataSetChoices
                  label="dataSet"
                  value={state.dataSet}
                  choices={DATASET_CHOICES}
                  disabledChoices={
                    state.displayType !== DisplayType.TABLE
                      ? [
                          [
                            DATASET_CHOICES[1][0],
                            t('This data set is restricted to the table visualization.'),
                          ],
                        ]
                      : undefined
                  }
                  onChange={handleDataSetChange}
                />
              </BuildStep>
              {[DisplayType.TABLE, DisplayType.TOP_N].includes(state.displayType) && (
                <BuildStep
                  title={t('Columns')}
                  description="Description of what this means"
                >
                  {state.dataSet === DataSet.EVENTS ? (
                    <Measurements>
                      {({measurements}) => (
                        <ColumnFields
                          displayType={state.displayType}
                          organization={organization}
                          widgetType={widgetType}
                          columns={explodedFields}
                          errors={state.errors?.queries}
                          fieldOptions={getAmendedFieldOptions(measurements)}
                          onChange={handleYAxisOrColumnFieldChange}
                        />
                      )}
                    </Measurements>
                  ) : (
                    <ColumnFields
                      displayType={state.displayType}
                      organization={organization}
                      widgetType={widgetType}
                      columns={state.queries[0].fields.map(field =>
                        explodeField({field})
                      )}
                      errors={
                        state.errors?.queries?.[0]
                          ? [state.errors?.queries?.[0]]
                          : undefined
                      }
                      fieldOptions={generateIssueWidgetFieldOptions()}
                      onChange={newFields => {
                        const fieldStrings = newFields.map(generateFieldAsString);
                        const newQuery = cloneDeep(state.queries[0]);
                        newQuery.fields = fieldStrings;
                        handleQueryChange(0, newQuery);
                      }}
                    />
                  )}
                </BuildStep>
              )}
              {![DisplayType.TABLE].includes(state.displayType) && (
                <BuildStep
                  title={t('Choose your y-axis')}
                  description="Description of what this means"
                >
                  <Measurements>
                    {({measurements}) => (
                      <YAxisSelector
                        widgetType={widgetType}
                        displayType={state.displayType}
                        fields={explodedFields}
                        fieldOptions={getAmendedFieldOptions(measurements)}
                        onChange={handleYAxisOrColumnFieldChange}
                        errors={state.errors?.queries}
                      />
                    )}
                  </Measurements>
                </BuildStep>
              )}
              <BuildStep title={t('Query')} description="Description of what this means">
                <div>
                  {state.queries.map((query, queryIndex) => {
                    return (
                      <QueryField
                        key={queryIndex}
                        inline={false}
                        flexibleControlStateSize
                        stacked
                        error={state.errors?.[queryIndex]?.conditions}
                      >
                        <SearchConditionsWrapper>
                          <Search
                            searchSource="widget_builder"
                            organization={organization}
                            projectIds={selection.projects}
                            query={query.conditions}
                            fields={[]}
                            onSearch={field => {
                              // SearchBar will call handlers for both onSearch and onBlur
                              // when selecting a value from the autocomplete dropdown. This can
                              // cause state issues for the search bar in our use case. To prevent
                              // this, we set a timer in our onSearch handler to block our onBlur
                              // handler from firing if it is within 200ms, ie from clicking an
                              // autocomplete value.
                              setBlurTimeout(
                                window.setTimeout(() => {
                                  setBlurTimeout(null);
                                }, 200)
                              );

                              const newQuery: WidgetQuery = {
                                ...state.queries[queryIndex],
                                conditions: field,
                              };
                              handleQueryChange(queryIndex, newQuery);
                            }}
                            onBlur={field => {
                              if (!blurTimeout) {
                                const newQuery: WidgetQuery = {
                                  ...state.queries[queryIndex],
                                  conditions: field,
                                };
                                handleQueryChange(queryIndex, newQuery);
                              }
                            }}
                            useFormWrapper={false}
                            maxQueryLength={MAX_QUERY_LENGTH}
                          />
                          {!hideLegendAlias && (
                            <LegendAliasInput
                              type="text"
                              name="name"
                              required
                              value={query.name}
                              placeholder={t('Legend Alias')}
                              onChange={event => {
                                const newQuery: WidgetQuery = {
                                  ...state.queries[queryIndex],
                                  name: event.target.value,
                                };
                                handleQueryChange(queryIndex, newQuery);
                              }}
                            />
                          )}
                          {state.queries.length > 1 && (
                            <Button
                              size="zero"
                              borderless
                              onClick={() => handleQueryRemove(queryIndex)}
                              icon={<IconDelete />}
                              title={t('Remove query')}
                              aria-label={t('Remove query')}
                            />
                          )}
                        </SearchConditionsWrapper>
                      </QueryField>
                    );
                  })}
                  {canAddSearchConditions && (
                    <Button
                      size="small"
                      icon={<IconAdd isCircled />}
                      onClick={handleAddSearchConditions}
                    >
                      {t('Add query')}
                    </Button>
                  )}
                </div>
              </BuildStep>
              {[DisplayType.TABLE, DisplayType.TOP_N].includes(state.displayType) && (
                <BuildStep
                  title={t('Sort by')}
                  description="Description of what this means"
                >
                  <Field
                    inline={false}
                    flexibleControlStateSize
                    stacked
                    error={state.errors?.orderby}
                  >
                    {state.dataSet === DataSet.EVENTS ? (
                      <SelectControl
                        menuPlacement="auto"
                        value={state.queries[0].orderby}
                        name="orderby"
                        options={generateOrderOptions(state.queries[0].fields)}
                        onChange={(option: SelectValue<string>) => {
                          const newQuery: WidgetQuery = {
                            ...state.queries[0],
                            orderby: option.value,
                          };
                          handleQueryChange(0, newQuery);
                        }}
                      />
                    ) : (
                      <SelectControl
                        menuPlacement="auto"
                        value={state.queries[0].orderby || IssueSortOptions.DATE}
                        name="orderby"
                        options={generateIssueWidgetOrderOptions(
                          organization?.features?.includes('issue-list-trend-sort')
                        )}
                        onChange={(option: SelectValue<string>) => {
                          const newQuery: WidgetQuery = {
                            ...state.queries[0],
                            orderby: option.value,
                          };
                          handleQueryChange(0, newQuery);
                        }}
                      />
                    )}
                  </Field>
                </BuildStep>
              )}
              {notDashboardsOrigin && (
                <BuildStep
                  title={t('Choose your dashboard')}
                  description={t(
                    "Choose which dashboard you'd like to add this query to. It will appear as a widget."
                  )}
                >
                  <DashboardSelector
                    error={state.errors?.dashboard}
                    dashboards={state.dashboards}
                    onChange={selectedDashboard =>
                      setState({...state, selectedDashboard})
                    }
                    disabled={state.loading}
                  />
                </BuildStep>
              )}
            </BuildSteps>
          </Layout.Body>
        </PageContentWithoutPadding>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

export default withPageFilters(withTags(WidgetBuilder));

const PageContentWithoutPadding = styled(PageContent)`
  padding: 0;
`;

const VisualizationWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  margin-right: ${space(2)};
`;

const DataSetChoices = styled(RadioGroup)`
  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-auto-flow: column;
  }
`;

const DisplayTypeOptions = styled(SelectControl)`
  margin-bottom: ${space(1)};
`;

const SearchConditionsWrapper = styled('div')`
  display: flex;
  align-items: center;

  > * + * {
    margin-left: ${space(1)};
  }
`;

const Search = styled(SearchBar)`
  flex-grow: 1;
`;

const LegendAliasInput = styled(Input)`
  width: 33%;
`;

const QueryField = styled(Field)`
  padding-bottom: ${space(1)};
`;

const BuildSteps = styled(List)`
  gap: ${space(4)};
  max-width: 100%;

  @media (min-width: ${p => p.theme.breakpoints[4]}) {
    max-width: 50%;
  }
`;
