import {useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import set from 'lodash/set';

import Button from 'sentry/components/button';
import {generateOrderOptions} from 'sentry/components/dashboards/widgetQueriesForm';
import SearchBar from 'sentry/components/events/searchBar';
import Input from 'sentry/components/forms/controls/input';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import Field from 'sentry/components/forms/field';
import SelectControl from 'sentry/components/forms/selectControl';
import * as Layout from 'sentry/components/layouts/thirds';
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
import Measurements, {
  MeasurementCollection,
} from 'sentry/utils/measurements/measurements';
import {SPAN_OP_BREAKDOWN_FIELDS} from 'sentry/utils/performance/spanOperationBreakdowns/constants';
import withPageFilters from 'sentry/utils/withPageFilters';
import withTags from 'sentry/utils/withTags';
import {
  generateIssueWidgetFieldOptions,
  generateIssueWidgetOrderOptions,
} from 'sentry/views/dashboardsV2/widgetBuilder/issueWidget/utils';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

import {DEFAULT_STATS_PERIOD} from '../data';
import {
  DashboardDetails,
  DashboardListItem,
  DashboardWidgetSource,
  Widget,
  WidgetQuery,
  WidgetType,
} from '../types';
import WidgetCard from '../widgetCard';

import {normalizeQueries} from './eventWidget/utils';
import BuildStep from './buildStep';
import BuildSteps from './buildSteps';
import {ColumnFields} from './columnFields';
import Header from './header';
import {DataSet, DisplayType, displayTypes} from './utils';
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

type Props = RouteComponentProps<RouteParams, {}> & {
  dashboard: DashboardDetails;
  onSave: (Widgets: Widget[]) => void;
  organization: Organization;
  selection: PageFilters;
  tags: TagCollection;
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
  errors?: Record<'orderby' | 'conditions' | 'queries', any>;
  selectedDashboard?: SelectValue<string>;
};

function WidgetBuilder({
  dashboard,
  widget,
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
  tags,
}: Props) {
  const {widgetId, orgId, dashboardId} = params;
  const {source} = location.query;

  const isEditing = defined(widget);
  const orgSlug = organization.slug;
  const goBackLocation = {
    pathname: dashboardId
      ? `/organizations/${orgId}/dashboard/${dashboardId}/`
      : `/organizations/${orgId}/dashboards/new/`,
    query: {...location.query, dataSet: undefined},
  };

  // Construct PageFilters object using statsPeriod/start/end props so we can
  // render widget graph using saved timeframe from Saved/Prebuilt Query
  const pageFilters: PageFilters = statsPeriod
    ? {...selection, datetime: {start: null, end: null, period: statsPeriod, utc: null}}
    : start && end
    ? {...selection, datetime: {start, end, period: null, utc: null}}
    : selection;

  // when opening from discover or issues page, the user selects the dashboard in the widget UI
  const omitDashboardProp = [
    DashboardWidgetSource.DISCOVERV2,
    DashboardWidgetSource.ISSUE_DETAILS,
  ].includes(source);

  const [state, setState] = useState<State>(() => {
    if (!widget) {
      return {
        title: defaultTitle ?? t('Custom Widget'),
        displayType: displayType ?? DisplayType.TABLE,
        interval: '5m',
        queries: [defaultWidgetQuery ? {...defaultWidgetQuery} : {...QUERIES.events}],
        errors: undefined,
        loading: !!omitDashboardProp,
        dashboards: [],
        userHasModified: false,
        dataSet: DataSet.EVENTS,
      };
    }

    return {
      title: widget.title,
      displayType: widget.displayType,
      interval: widget.interval,
      queries: normalizeQueries(widget.displayType, widget.queries),
      errors: undefined,
      loading: false,
      dashboards: [],
      userHasModified: false,
      dataSet: widget.widgetType
        ? WIDGET_TYPE_TO_DATA_SET[widget.widgetType]
        : DataSet.EVENTS,
    };
  });
  const [blurTimeout, setBlurTimeout] = useState<null | number>(null);

  function handleDataSetChange(newDataSet: string) {
    setState(prevState => {
      const newState = cloneDeep(prevState);
      newState.queries.splice(0, newState.queries.length);
      set(newState, 'dataSet', newDataSet);

      if (newDataSet === DataSet.ISSUES) {
        set(newState, 'displayType', DisplayType.TABLE);
      }

      newState.queries.push(
        ...(widget?.widgetType &&
        WIDGET_TYPE_TO_DATA_SET[widget.widgetType] === newDataSet
          ? widget.queries
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

  if (
    isEditing &&
    (!defined(widgetId) ||
      !dashboard.widgets.find(dashboardWidget => dashboardWidget.id === String(widgetId)))
  ) {
    return (
      <SentryDocumentTitle title={dashboard.title} orgSlug={orgSlug}>
        <PageContent>
          <LoadingError message={t('Widget not found.')} />
        </PageContent>
      </SentryDocumentTitle>
    );
  }

  function handleChangeYAxisOrColumnField(newFields: QueryFieldValue[]) {
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

      if (!aggregateAliasFieldStrings.includes(orderbyAggregateAliasField)) {
        newQuery.orderby = '';

        if (prevAggregateAliasFieldStrings.length === newFields.length) {
          // The Field that was used in orderby has changed. Get the new field.
          newQuery.orderby = `${descending && '-'}${
            aggregateAliasFieldStrings[
              prevAggregateAliasFieldStrings.indexOf(orderbyAggregateAliasField)
            ]
          }`;
        }
      }

      handleQueryChange(queryIndex, newQuery);
    }
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

  const widgetType =
    state.dataSet === DataSet.EVENTS
      ? WidgetType.DISCOVER
      : state.dataSet === DataSet.ISSUES
      ? WidgetType.ISSUE
      : WidgetType.METRICS;

  const explodedFields = state.queries[0].fields.map(field => explodeField({field}));
  function getAmendedFieldOptions(measurements: MeasurementCollection) {
    return generateFieldOptions({
      organization,
      tagKeys: Object.values(tags).map(({key}) => key),
      measurementKeys: Object.values(measurements).map(({key}) => key),
      spanOperationBreakdownKeys: SPAN_OP_BREAKDOWN_FIELDS,
    });
  }

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
            goBackLocation={goBackLocation}
            onChangeTitle={newTitle => setState({...state, title: newTitle})}
          />
          <Layout.Body>
            <BuildSteps>
              <BuildStep
                title={t('Choose your visualization')}
                description={t(
                  'This is a preview of how your widget will appear in the dashboard.'
                )}
              >
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
                  widget={{
                    title: state.title,
                    displayType: state.displayType,
                    interval: state.interval,
                    queries: state.queries,
                    widgetType,
                  }}
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
                  choices={
                    state.displayType === DisplayType.TABLE
                      ? DATASET_CHOICES
                      : [DATASET_CHOICES[0]]
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
                          onChange={handleChangeYAxisOrColumnField}
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
                        onChange={handleChangeYAxisOrColumnField}
                        // TODO: errors={getFirstQueryError('fields')}
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
                        error={state.errors?.[queryIndex].conditions}
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
