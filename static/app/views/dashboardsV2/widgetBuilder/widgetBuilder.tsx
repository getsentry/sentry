import {useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import set from 'lodash/set';

import Button from 'sentry/components/button';
import SearchBar from 'sentry/components/events/searchBar';
import SelectControl from 'sentry/components/forms/selectControl';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import {PanelAlert} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import Tooltip from 'sentry/components/tooltip';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {DateString, Organization, PageFilters, SelectValue} from 'sentry/types';
import {defined} from 'sentry/utils';
import withPageFilters from 'sentry/utils/withPageFilters';
import Input from 'sentry/views/settings/components/forms/controls/input';
import RadioGroup from 'sentry/views/settings/components/forms/controls/radioGroup';
import Field from 'sentry/views/settings/components/forms/field';

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
import Header from './header';
import {DataSet, DisplayType, displayTypes} from './utils';

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
        title:
          defaultTitle ??
          t('Custom %s Widget', displayTypes[displayType ?? DisplayType.TABLE]),
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

  function handleQueryChange(newQuery: WidgetQuery, index: number) {
    setState(prevState => {
      const newState = cloneDeep(prevState);
      set(newState, `queries.${index}`, newQuery);
      set(newState, 'userHasModified', true);
      return {...newState, errors: undefined};
    });
  }

  if (!Object.values(DataSet).includes(state.dataSet)) {
    return (
      <SentryDocumentTitle title={dashboard.title} orgSlug={orgSlug}>
        <PageContent>
          <LoadingError message={t('Data set not found.')} />
        </PageContent>
      </SentryDocumentTitle>
    );
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

  return (
    <SentryDocumentTitle title={dashboard.title} orgSlug={orgSlug}>
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
              title={t('Choose your data set')}
              description={t(
                'Monitor specific events such as errors and transactions or metrics based on Release Health.'
              )}
            >
              <DataSetChoices
                label="dataSet"
                value={state.dataSet}
                choices={DATASET_CHOICES}
                onChange={handleDataSetChange}
              />
            </BuildStep>
            <BuildStep
              title={t('Choose your visualization')}
              description={t(
                'This is a preview of how your widget will appear in the dashboard.'
              )}
            >
              <Tooltip
                title={t('Visualization is restricted to table for the data set issues')}
                disabled={state.dataSet !== DataSet.ISSUES}
              >
                <DisplayTypeOptions
                  name="displayType"
                  options={DISPLAY_TYPES_OPTIONS}
                  value={state.displayType}
                  onChange={(option: {label: string; value: DisplayType}) => {
                    setState({...state, displayType: option.value});
                  }}
                  disabled={state.dataSet === DataSet.ISSUES}
                />
              </Tooltip>
              <WidgetCard
                organization={organization}
                selection={pageFilters}
                widget={{
                  title: state.title,
                  displayType: state.displayType,
                  interval: state.interval,
                  queries: state.queries,
                  widgetType:
                    state.dataSet === DataSet.EVENTS
                      ? WidgetType.DISCOVER
                      : state.dataSet === DataSet.ISSUES
                      ? WidgetType.ISSUE
                      : WidgetType.METRICS,
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
              title={t('Choose your y-axis')}
              description="Description of what this means"
            >
              WIP
            </BuildStep>
            <BuildStep title={t('Query')} description="Description of what this means">
              <div>
                {state.queries.map((query, queryIndex) => {
                  return (
                    <QueryField
                      key={queryIndex}
                      inline={false}
                      flexibleControlStateSize
                      stacked
                    >
                      <SearchConditionsWrapper>
                        <StyledSearchBar
                          searchSource="widget_builder"
                          organization={organization}
                          projectIds={selection.projects}
                          query={query.conditions}
                          fields={[]}
                          onSearch={field => {
                            const newQuery: WidgetQuery = {
                              ...state.queries[queryIndex],
                              conditions: field,
                            };
                            handleQueryChange(newQuery, queryIndex);
                          }}
                          // onSearch={field => {
                          //   // SearchBar will call handlers for both onSearch and onBlur
                          //   // when selecting a value from the autocomplete dropdown. This can
                          //   // cause state issues for the search bar in our use case. To prevent
                          //   // this, we set a timer in our onSearch handler to block our onBlur
                          //   // handler from firing if it is within 200ms, ie from clicking an
                          //   // autocomplete value.
                          //   this.blurTimeout = window.setTimeout(() => {
                          //     this.blurTimeout = null;
                          //   }, 200);
                          //   return this.handleFieldChange(queryIndex, 'conditions')(field);
                          // }}
                          // onBlur={field => {
                          //   if (!this.blurTimeout) {
                          //     this.handleFieldChange(queryIndex, 'conditions')(field);
                          //   }
                          // }}
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
                              handleQueryChange(newQuery, queryIndex);
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
            <BuildStep
              title={t('Group your results')}
              description="Description of what this means"
            >
              WIP
            </BuildStep>
          </BuildSteps>
        </Layout.Body>
      </PageContentWithoutPadding>
    </SentryDocumentTitle>
  );
}

export default withPageFilters(WidgetBuilder);

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

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;

const LegendAliasInput = styled(Input)`
  width: 33%;
`;

const QueryField = styled(Field)`
  padding-bottom: ${space(1)};
`;
