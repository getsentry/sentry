import * as React from 'react';
import {browserHistory} from 'react-router';
import {OptionProps} from 'react-select';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import pick from 'lodash/pick';
import set from 'lodash/set';

import {validateWidget} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import IssueWidgetQueriesForm from 'sentry/components/dashboards/issueWidgetQueriesForm';
import WidgetQueriesForm from 'sentry/components/dashboards/widgetQueriesForm';
import Input from 'sentry/components/forms/controls/input';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import Field from 'sentry/components/forms/field';
import FieldLabel from 'sentry/components/forms/field/fieldLabel';
import SelectControl from 'sentry/components/forms/selectControl';
import {PanelAlert} from 'sentry/components/panels';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  DateString,
  MetricsMetaCollection,
  MetricTagCollection,
  Organization,
  PageFilters,
  SelectValue,
  TagCollection,
} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import Measurements from 'sentry/utils/measurements/measurements';
import {SessionMetric} from 'sentry/utils/metrics/fields';
import {SPAN_OP_BREAKDOWN_FIELDS} from 'sentry/utils/performance/spanOperationBreakdowns/constants';
import withApi from 'sentry/utils/withApi';
import withMetricsMeta from 'sentry/utils/withMetricsMeta';
import withMetricsTags from 'sentry/utils/withMetricsTags';
import withPageFilters from 'sentry/utils/withPageFilters';
import withTags from 'sentry/utils/withTags';
import {DISPLAY_TYPE_CHOICES} from 'sentry/views/dashboardsV2/data';
import {assignTempId} from 'sentry/views/dashboardsV2/layoutUtils';
import {
  DashboardDetails,
  DashboardListItem,
  DashboardWidgetSource,
  DisplayType,
  MAX_WIDGETS,
  Widget,
  WidgetQuery,
  WidgetType,
} from 'sentry/views/dashboardsV2/types';
import {generateIssueWidgetFieldOptions} from 'sentry/views/dashboardsV2/widgetBuilder/issueWidget/utils';
import {
  DEFAULT_METRICS_FIELDS,
  generateMetricsWidgetFieldOptions,
  METRICS_FIELDS_ALLOW_LIST,
} from 'sentry/views/dashboardsV2/widgetBuilder/metricWidget/fields';
import {mapErrors, normalizeQueries} from 'sentry/views/dashboardsV2/widgetBuilder/utils';
import WidgetCard from 'sentry/views/dashboardsV2/widgetCard';
import {WidgetTemplate} from 'sentry/views/dashboardsV2/widgetLibrary/data';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

import Option from '../forms/selectOption';
import Tooltip from '../tooltip';

import {TAB, TabsButtonBar} from './dashboardWidgetLibraryModal/tabsButtonBar';

export type DashboardWidgetModalOptions = {
  organization: Organization;
  source: DashboardWidgetSource;
  dashboard?: DashboardDetails;
  defaultTableColumns?: readonly string[];
  defaultTitle?: string;
  defaultWidgetQuery?: WidgetQuery;
  displayType?: DisplayType;
  end?: DateString;
  onAddLibraryWidget?: (widgets: Widget[]) => void;
  onAddWidget?: (data: Widget) => void;
  onUpdateWidget?: (nextWidget: Widget) => void;
  selectedWidgets?: WidgetTemplate[];
  selection?: PageFilters;
  start?: DateString;
  statsPeriod?: string | null;
  widget?: Widget;
};

type Props = ModalRenderProps &
  DashboardWidgetModalOptions & {
    api: Client;
    metricsMeta: MetricsMetaCollection;
    metricsTags: MetricTagCollection;
    organization: Organization;
    selection: PageFilters;
    tags: TagCollection;
  };

type FlatValidationError = {
  [key: string]: string | FlatValidationError[] | FlatValidationError;
};

type State = {
  dashboards: DashboardListItem[];
  displayType: Widget['displayType'];
  interval: Widget['interval'];
  loading: boolean;
  queries: Widget['queries'];
  title: string;
  userHasModified: boolean;
  widgetType: WidgetType;
  errors?: Record<string, any>;
  selectedDashboard?: SelectValue<string>;
};

const newDiscoverQuery = {
  name: '',
  fields: ['count()'],
  conditions: '',
  orderby: '',
};

const newIssueQuery = {
  name: '',
  fields: ['issue', 'assignee', 'title'] as string[],
  conditions: '',
  orderby: '',
};

const newMetricsQuery = {
  name: '',
  fields: [`sum(${SessionMetric.SENTRY_SESSIONS_SESSION})`],
  conditions: '',
  orderby: '',
};

const DiscoverDataset: [WidgetType, string] = [
  WidgetType.DISCOVER,
  t('All Events (Errors and Transactions)'),
];
const IssueDataset: [WidgetType, string] = [
  WidgetType.ISSUE,
  t('Issues (States, Assignment, Time, etc.)'),
];
const MetricsDataset: [WidgetType, string] = [
  WidgetType.METRICS,
  t('Metrics (Release Health)'),
];

class AddDashboardWidgetModal extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    const {widget, defaultWidgetQuery, defaultTitle, displayType} = props;
    if (!widget) {
      this.state = {
        title: defaultTitle ?? '',
        displayType: displayType ?? DisplayType.TABLE,
        interval: '5m',
        queries: [defaultWidgetQuery ? {...defaultWidgetQuery} : {...newDiscoverQuery}],
        errors: undefined,
        loading: !!this.omitDashboardProp,
        dashboards: [],
        userHasModified: false,
        widgetType: WidgetType.DISCOVER,
      };
      return;
    }

    this.state = {
      title: widget.title,
      displayType: widget.displayType,
      interval: widget.interval,
      queries: normalizeQueries(widget.displayType, widget.queries),
      errors: undefined,
      loading: false,
      dashboards: [],
      userHasModified: false,
      widgetType: widget.widgetType ?? WidgetType.DISCOVER,
    };
  }

  componentDidMount() {
    if (this.omitDashboardProp) {
      this.fetchDashboards();
    }
  }

  get omitDashboardProp() {
    // when opening from discover or issues page, the user selects the dashboard in the widget UI
    return [
      DashboardWidgetSource.DISCOVERV2,
      DashboardWidgetSource.ISSUE_DETAILS,
    ].includes(this.props.source);
  }

  get fromLibrary() {
    return this.props.source === DashboardWidgetSource.LIBRARY;
  }

  handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const {
      api,
      closeModal,
      organization,
      onAddWidget,
      onUpdateWidget,
      widget: previousWidget,
      source,
    } = this.props;
    this.setState({loading: true});
    let errors: FlatValidationError = {};
    const widgetData: Widget = assignTempId(
      pick(this.state, ['title', 'displayType', 'interval', 'queries', 'widgetType'])
    );
    if (previousWidget) {
      widgetData.layout = previousWidget?.layout;
    }
    // Only Table and Top N views need orderby
    if (![DisplayType.TABLE, DisplayType.TOP_N].includes(widgetData.displayType)) {
      widgetData.queries.forEach(query => {
        query.orderby = '';
      });
    }
    try {
      await validateWidget(api, organization.slug, widgetData);
      if (typeof onUpdateWidget === 'function' && !!previousWidget) {
        onUpdateWidget({
          id: previousWidget?.id,
          layout: previousWidget?.layout,
          ...widgetData,
        });
        addSuccessMessage(t('Updated widget.'));
        trackAdvancedAnalyticsEvent('dashboards_views.edit_widget_modal.confirm', {
          organization,
        });
      } else if (onAddWidget) {
        onAddWidget(widgetData);
        addSuccessMessage(t('Added widget.'));
        trackAdvancedAnalyticsEvent('dashboards_views.add_widget_modal.confirm', {
          organization,
          data_set: widgetData.widgetType ?? WidgetType.DISCOVER,
        });
      }
      if (source === DashboardWidgetSource.DASHBOARDS) {
        closeModal();
      }
    } catch (err) {
      errors = mapErrors(err?.responseJSON ?? {}, {});
      this.setState({errors});
    } finally {
      this.setState({loading: false});
      if (this.omitDashboardProp) {
        this.handleSubmitFromSelectedDashboard(errors, widgetData);
      }
      if (this.fromLibrary) {
        this.handleSubmitFromLibrary(errors, widgetData);
      }
    }
  };

  handleSubmitFromSelectedDashboard = async (
    errors: FlatValidationError,
    widgetData: Widget
  ) => {
    const {closeModal, organization, selection} = this.props;
    const {selectedDashboard, dashboards} = this.state;
    // Validate that a dashboard was selected since api call to /dashboards/widgets/ does not check for dashboard
    if (
      !selectedDashboard ||
      !(
        dashboards.find(({title, id}) => {
          return title === selectedDashboard?.label && id === selectedDashboard?.value;
        }) || selectedDashboard.value === 'new'
      )
    ) {
      errors.dashboard = t('This field may not be blank');
      this.setState({errors});
    }
    if (!Object.keys(errors).length && selectedDashboard) {
      closeModal();

      const queryData: {
        queryConditions: string[];
        queryFields: string[];
        queryNames: string[];
        queryOrderby: string;
      } = {
        queryNames: [],
        queryConditions: [],
        queryFields: widgetData.queries[0].fields,
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
        ...selection.datetime,
        project: selection.projects,
        environment: selection.environments,
      };

      trackAdvancedAnalyticsEvent('discover_views.add_to_dashboard.confirm', {
        organization,
      });

      if (selectedDashboard.value === 'new') {
        browserHistory.push({
          pathname: `/organizations/${organization.slug}/dashboards/new/`,
          query: pathQuery,
        });
      } else {
        browserHistory.push({
          pathname: `/organizations/${organization.slug}/dashboard/${selectedDashboard.value}/`,
          query: pathQuery,
        });
      }
    }
  };

  handleSubmitFromLibrary = async (errors: FlatValidationError, widgetData: Widget) => {
    const {closeModal, dashboard, onAddLibraryWidget, organization} = this.props;
    if (!dashboard) {
      errors.dashboard = t('This field may not be blank');
      this.setState({errors});
      addErrorMessage(t('Widget may only be added to a Dashboard'));
    }

    if (!Object.keys(errors).length && dashboard && onAddLibraryWidget) {
      onAddLibraryWidget([...dashboard.widgets, widgetData]);
      closeModal();
    }
    trackAdvancedAnalyticsEvent('dashboards_views.add_widget_modal.save', {
      organization,
      data_set: widgetData.widgetType ?? WidgetType.DISCOVER,
    });
  };

  handleDefaultFields = (newDisplayType: DisplayType) => {
    const {displayType, defaultWidgetQuery, defaultTableColumns, widget} = this.props;
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      const normalized = normalizeQueries(newDisplayType, prevState.queries);
      if (newDisplayType === DisplayType.TOP_N) {
        // TOP N display should only allow a single query
        normalized.splice(1);
      }

      if (
        newDisplayType === DisplayType.WORLD_MAP &&
        prevState.widgetType === WidgetType.METRICS
      ) {
        // World Map display type only supports Discover Dataset
        // so set state to default discover query.
        set(newState, 'queries', normalizeQueries(newDisplayType, [newDiscoverQuery]));
        set(newState, 'widgetType', WidgetType.DISCOVER);
        return {...newState, errors: undefined};
      }

      if (!prevState.userHasModified) {
        // If the Widget is an issue widget,
        if (
          newDisplayType === DisplayType.TABLE &&
          widget?.widgetType === WidgetType.ISSUE
        ) {
          set(newState, 'queries', widget.queries);
          set(newState, 'widgetType', WidgetType.ISSUE);
          return {...newState, errors: undefined};
        }

        // Default widget provided by Add to Dashboard from Discover
        if (defaultWidgetQuery && defaultTableColumns) {
          // If switching to Table visualization, use saved query fields for Y-Axis if user has not made query changes
          // This is so the widget can reflect the same columns as the table in Discover without requiring additional user input
          if (newDisplayType === DisplayType.TABLE) {
            normalized.forEach(query => {
              query.fields = [...defaultTableColumns];
            });
          } else if (newDisplayType === displayType) {
            // When switching back to original display type, default fields back to the fields provided from the discover query
            normalized.forEach(query => {
              query.fields = [...defaultWidgetQuery.fields];
              query.orderby = defaultWidgetQuery.orderby;
            });
          }
        }
      }

      if (prevState.widgetType === WidgetType.ISSUE) {
        set(newState, 'widgetType', WidgetType.DISCOVER);
      }
      set(newState, 'queries', normalized);
      return {...newState, errors: undefined};
    });
  };

  handleFieldChange = (field: string) => (value: string) => {
    const {organization, source} = this.props;
    const {displayType} = this.state;
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      set(newState, field, value);

      trackAdvancedAnalyticsEvent('dashboards_views.add_widget_modal.change', {
        from: source,
        field,
        value,
        widget_type: prevState.widgetType,
        organization,
      });

      return {...newState, errors: undefined};
    });

    if (field === 'displayType' && value !== displayType) {
      this.handleDefaultFields(value as DisplayType);
    }
  };

  handleQueryChange = (widgetQuery: WidgetQuery, index: number) => {
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      set(newState, `queries.${index}`, widgetQuery);
      set(newState, 'userHasModified', true);

      return {...newState, errors: undefined};
    });
  };

  handleQueryRemove = (index: number) => {
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      newState.queries.splice(index, 1);

      return {...newState, errors: undefined};
    });
  };

  handleAddSearchConditions = () => {
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      const query = cloneDeep(newDiscoverQuery);
      query.fields = this.state.queries[0].fields;
      newState.queries.push(query);

      return newState;
    });
  };

  defaultQuery(widgetType: string): WidgetQuery {
    switch (widgetType) {
      case WidgetType.ISSUE:
        return newIssueQuery;
      case WidgetType.METRICS:
        return newMetricsQuery;
      case WidgetType.DISCOVER:
      default:
        return newDiscoverQuery;
    }
  }

  handleDatasetChange = (widgetType: string) => {
    const {widget} = this.props;
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      newState.queries.splice(0, newState.queries.length);
      set(newState, 'widgetType', widgetType);
      newState.queries.push(
        ...(widget?.widgetType === widgetType
          ? widget.queries
          : [this.defaultQuery(widgetType)])
      );
      set(newState, 'userHasModified', true);
      return {...newState, errors: undefined};
    });
  };

  canAddSearchConditions() {
    const rightDisplayType = ['line', 'area', 'stacked_area', 'bar'].includes(
      this.state.displayType
    );
    const underQueryLimit = this.state.queries.length < 3;

    return rightDisplayType && underQueryLimit;
  }

  async fetchDashboards() {
    const {api, organization} = this.props;
    const promise: Promise<DashboardListItem[]> = api.requestPromise(
      `/organizations/${organization.slug}/dashboards/`,
      {
        method: 'GET',
        query: {sort: 'myDashboardsAndRecentlyViewed'},
      }
    );

    try {
      const dashboards = await promise;
      this.setState({
        dashboards,
      });
    } catch (error) {
      const errorResponse = error?.responseJSON ?? null;
      if (errorResponse) {
        addErrorMessage(errorResponse);
      } else {
        addErrorMessage(t('Unable to fetch dashboards'));
      }
    }
    this.setState({loading: false});
  }

  handleDashboardChange(option: SelectValue<string>) {
    this.setState({selectedDashboard: option});
  }

  renderDashboardSelector() {
    const {errors, loading, dashboards} = this.state;
    const dashboardOptions = dashboards.map(d => {
      return {
        label: d.title,
        value: d.id,
        isDisabled: d.widgetDisplay.length >= MAX_WIDGETS,
      };
    });
    return (
      <React.Fragment>
        <p>
          {t(
            `Choose which dashboard you'd like to add this query to. It will appear as a widget.`
          )}
        </p>
        <Field
          label={t('Custom Dashboard')}
          inline={false}
          flexibleControlStateSize
          stacked
          error={errors?.dashboard}
          style={{marginBottom: space(1), position: 'relative'}}
          required
        >
          <SelectControl
            name="dashboard"
            options={[
              {label: t('+ Create New Dashboard'), value: 'new'},
              ...dashboardOptions,
            ]}
            onChange={(option: SelectValue<string>) => this.handleDashboardChange(option)}
            disabled={loading}
            components={{
              Option: ({label, data, ...optionProps}: OptionProps<any>) => (
                <Tooltip
                  disabled={!!!data.isDisabled}
                  title={tct('Max widgets ([maxWidgets]) per dashboard reached.', {
                    maxWidgets: MAX_WIDGETS,
                  })}
                  containerDisplayMode="block"
                  position="right"
                >
                  <Option label={label} data={data} {...(optionProps as any)} />
                </Tooltip>
              ),
            }}
          />
        </Field>
      </React.Fragment>
    );
  }

  renderWidgetQueryForm() {
    const {
      organization,
      selection,
      tags,
      metricsTags,
      metricsMeta,
      start,
      end,
      statsPeriod,
    } = this.props;
    const state = this.state;
    const errors = state.errors;

    // Construct PageFilters object using statsPeriod/start/end props so we can
    // render widget graph using saved timeframe from Saved/Prebuilt Query
    const querySelection: PageFilters = statsPeriod
      ? {...selection, datetime: {start: null, end: null, period: statsPeriod, utc: null}}
      : start && end
      ? {...selection, datetime: {start, end, period: null, utc: null}}
      : selection;

    const filteredMeta = Object.values(metricsMeta).filter(field =>
      METRICS_FIELDS_ALLOW_LIST.includes(field.name)
    );
    const issueWidgetFieldOptions = generateIssueWidgetFieldOptions();
    const metricsWidgetFieldOptions = generateMetricsWidgetFieldOptions(
      filteredMeta.length ? filteredMeta : DEFAULT_METRICS_FIELDS,
      Object.values(metricsTags).map(({key}) => key)
    );
    const fieldOptions = (measurementKeys: string[]) =>
      generateFieldOptions({
        organization,
        tagKeys: Object.values(tags).map(({key}) => key),
        measurementKeys,
        spanOperationBreakdownKeys: SPAN_OP_BREAKDOWN_FIELDS,
      });

    switch (state.widgetType) {
      case WidgetType.ISSUE:
        return (
          <React.Fragment>
            <IssueWidgetQueriesForm
              organization={organization}
              selection={querySelection}
              fieldOptions={issueWidgetFieldOptions}
              query={state.queries[0]}
              error={errors?.queries?.[0]}
              onChange={widgetQuery => this.handleQueryChange(widgetQuery, 0)}
            />
            <WidgetCard
              organization={organization}
              selection={querySelection}
              widget={{...this.state, displayType: DisplayType.TABLE}}
              isEditing={false}
              onDelete={() => undefined}
              onEdit={() => undefined}
              onDuplicate={() => undefined}
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
          </React.Fragment>
        );

      case WidgetType.METRICS:
        return (
          <React.Fragment>
            <WidgetQueriesForm
              organization={organization}
              selection={querySelection}
              displayType={state.displayType}
              widgetType={state.widgetType}
              queries={state.queries}
              errors={errors?.queries}
              fieldOptions={metricsWidgetFieldOptions}
              onChange={(queryIndex: number, widgetQuery: WidgetQuery) =>
                this.handleQueryChange(widgetQuery, queryIndex)
              }
              canAddSearchConditions={this.canAddSearchConditions()}
              handleAddSearchConditions={this.handleAddSearchConditions}
              handleDeleteQuery={this.handleQueryRemove}
            />
            <WidgetCard
              organization={organization}
              selection={querySelection}
              widget={this.state}
              isEditing={false}
              onDelete={() => undefined}
              onEdit={() => undefined}
              onDuplicate={() => undefined}
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
          </React.Fragment>
        );

      case WidgetType.DISCOVER:
      default:
        return (
          <React.Fragment>
            <Measurements>
              {({measurements}) => {
                const measurementKeys = Object.values(measurements).map(({key}) => key);
                const amendedFieldOptions = fieldOptions(measurementKeys);
                return (
                  <WidgetQueriesForm
                    organization={organization}
                    selection={querySelection}
                    fieldOptions={amendedFieldOptions}
                    displayType={state.displayType}
                    widgetType={state.widgetType}
                    queries={state.queries}
                    errors={errors?.queries}
                    onChange={(queryIndex: number, widgetQuery: WidgetQuery) =>
                      this.handleQueryChange(widgetQuery, queryIndex)
                    }
                    canAddSearchConditions={this.canAddSearchConditions()}
                    handleAddSearchConditions={this.handleAddSearchConditions}
                    handleDeleteQuery={this.handleQueryRemove}
                  />
                );
              }}
            </Measurements>
            <WidgetCard
              organization={organization}
              selection={querySelection}
              widget={this.state}
              isEditing={false}
              onDelete={() => undefined}
              onEdit={() => undefined}
              onDuplicate={() => undefined}
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
          </React.Fragment>
        );
    }
  }

  render() {
    const {
      Footer,
      Body,
      Header,
      organization,
      widget: previousWidget,
      dashboard,
      selectedWidgets,
      onUpdateWidget,
      onAddLibraryWidget,
      source,
    } = this.props;
    const state = this.state;
    const errors = state.errors;

    const isUpdatingWidget = typeof onUpdateWidget === 'function' && !!previousWidget;

    const showDatasetSelector =
      [DashboardWidgetSource.DASHBOARDS, DashboardWidgetSource.LIBRARY].includes(
        source
      ) && state.displayType !== DisplayType.WORLD_MAP;

    const showIssueDatasetSelector =
      showDatasetSelector &&
      organization.features.includes('issues-in-dashboards') &&
      state.displayType === DisplayType.TABLE;

    const showMetricsDatasetSelector =
      showDatasetSelector && organization.features.includes('dashboards-metrics');

    const datasetChoices: [WidgetType, string][] = [DiscoverDataset];

    if (showIssueDatasetSelector) {
      datasetChoices.push(IssueDataset);
    }

    if (showMetricsDatasetSelector) {
      datasetChoices.push(MetricsDataset);
    }

    return (
      <React.Fragment>
        <Header closeButton>
          <h4>
            {this.omitDashboardProp
              ? t('Add Widget to Dashboard')
              : this.fromLibrary
              ? t('Add Widget(s)')
              : isUpdatingWidget
              ? t('Edit Widget')
              : t('Add Widget')}
          </h4>
        </Header>
        <Body>
          {this.omitDashboardProp && this.renderDashboardSelector()}
          {this.fromLibrary && dashboard && onAddLibraryWidget ? (
            <TabsButtonBar
              activeTab={TAB.Custom}
              organization={organization}
              dashboard={dashboard}
              selectedWidgets={selectedWidgets}
              customWidget={this.state}
              onAddWidget={onAddLibraryWidget}
            />
          ) : null}
          <DoubleFieldWrapper>
            <StyledField
              data-test-id="widget-name"
              label={t('Widget Name')}
              inline={false}
              flexibleControlStateSize
              stacked
              error={errors?.title}
              required
            >
              <Input
                data-test-id="widget-title-input"
                type="text"
                name="title"
                maxLength={255}
                required
                value={state.title}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  this.handleFieldChange('title')(event.target.value);
                }}
                disabled={state.loading}
              />
            </StyledField>
            <StyledField
              data-test-id="chart-type"
              label={t('Visualization Display')}
              inline={false}
              flexibleControlStateSize
              stacked
              error={errors?.displayType}
              required
            >
              <SelectControl
                options={DISPLAY_TYPE_CHOICES.slice()}
                name="displayType"
                value={state.displayType}
                onChange={option => this.handleFieldChange('displayType')(option.value)}
                disabled={state.loading}
              />
            </StyledField>
          </DoubleFieldWrapper>
          {(showIssueDatasetSelector || showMetricsDatasetSelector) && (
            <React.Fragment>
              <StyledFieldLabel>{t('Data Set')}</StyledFieldLabel>
              <StyledRadioGroup
                style={{flex: 1}}
                choices={datasetChoices}
                value={state.widgetType}
                label={t('Dataset')}
                onChange={this.handleDatasetChange}
              />
            </React.Fragment>
          )}
          {this.renderWidgetQueryForm()}
        </Body>
        <Footer>
          <ButtonBar gap={1}>
            <Button
              external
              href="https://docs.sentry.io/product/dashboards/custom-dashboards/#widget-builder"
            >
              {t('Read the docs')}
            </Button>
            <Button
              data-test-id="add-widget"
              priority="primary"
              type="button"
              onClick={this.handleSubmit}
              disabled={state.loading}
              busy={state.loading}
            >
              {this.fromLibrary
                ? t('Save')
                : isUpdatingWidget
                ? t('Update Widget')
                : t('Add Widget')}
            </Button>
          </ButtonBar>
        </Footer>
      </React.Fragment>
    );
  }
}

const DoubleFieldWrapper = styled('div')`
  display: inline-grid;
  grid-template-columns: repeat(2, 1fr);
  grid-column-gap: ${space(1)};
  width: 100%;
`;

export const modalCss = css`
  width: 100%;
  max-width: 700px;
  margin: 70px auto;
`;

const StyledField = styled(Field)`
  position: relative;
`;

const StyledRadioGroup = styled(RadioGroup)`
  padding-bottom: ${space(2)};
`;

const StyledFieldLabel = styled(FieldLabel)`
  padding-bottom: ${space(1)};
  display: inline-flex;
`;

export default withApi(
  withPageFilters(withTags(withMetricsMeta(withMetricsTags(AddDashboardWidgetModal))))
);
