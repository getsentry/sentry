import * as React from 'react';
import {browserHistory} from 'react-router';
import {components, OptionProps} from 'react-select';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import pick from 'lodash/pick';
import set from 'lodash/set';

import {validateWidget} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {
  ModalRenderProps,
  openDashboardWidgetLibraryModal,
} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import WidgetQueriesForm from 'sentry/components/dashboards/widgetQueriesForm';
import SelectControl from 'sentry/components/forms/selectControl';
import {PanelAlert} from 'sentry/components/panels';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  DateString,
  GlobalSelection,
  Organization,
  RelativePeriod,
  SelectValue,
  TagCollection,
} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import Measurements from 'sentry/utils/measurements/measurements';
import withApi from 'sentry/utils/withApi';
import withGlobalSelection from 'sentry/utils/withGlobalSelection';
import withTags from 'sentry/utils/withTags';
import {DISPLAY_TYPE_CHOICES} from 'sentry/views/dashboardsV2/data';
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
import {
  mapErrors,
  normalizeQueries,
} from 'sentry/views/dashboardsV2/widget/eventWidget/utils';
import WidgetCard from 'sentry/views/dashboardsV2/widgetCard';
import {WidgetTemplate} from 'sentry/views/dashboardsV2/widgetLibrary/data';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';
import Input from 'sentry/views/settings/components/forms/controls/input';
import Field from 'sentry/views/settings/components/forms/field';

import Tooltip from '../tooltip';

export type DashboardWidgetModalOptions = {
  organization: Organization;
  dashboard?: DashboardDetails;
  selection?: GlobalSelection;
  onAddWidget?: (data: Widget) => void;
  widget?: Widget;
  onUpdateWidget?: (nextWidget: Widget) => void;
  defaultWidgetQuery?: WidgetQuery;
  defaultTableColumns?: readonly string[];
  defaultTitle?: string;
  displayType?: DisplayType;
  source: DashboardWidgetSource;
  start?: DateString;
  end?: DateString;
  statsPeriod?: RelativePeriod | string;
  selectedWidgets?: WidgetTemplate[];
  onAddLibraryWidget?: (widgets: Widget[]) => void;
};

type Props = ModalRenderProps &
  DashboardWidgetModalOptions & {
    api: Client;
    organization: Organization;
    selection: GlobalSelection;
    tags: TagCollection;
  };

type FlatValidationError = {
  [key: string]: string | FlatValidationError[] | FlatValidationError;
};

type State = {
  title: string;
  displayType: Widget['displayType'];
  interval: Widget['interval'];
  queries: Widget['queries'];
  loading: boolean;
  errors?: Record<string, any>;
  dashboards: DashboardListItem[];
  selectedDashboard?: SelectValue<string>;
  userHasModified: boolean;
  widgetType: WidgetType;
};

const newQuery = {
  name: '',
  fields: ['count()'],
  conditions: '',
  orderby: '',
};
class AddDashboardWidgetModal extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    const {widget, defaultWidgetQuery, defaultTitle, displayType} = props;
    if (!widget) {
      this.state = {
        title: defaultTitle ?? '',
        displayType: displayType ?? DisplayType.LINE,
        interval: '5m',
        queries: [defaultWidgetQuery ? {...defaultWidgetQuery} : {...newQuery}],
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
      widgetType: WidgetType.DISCOVER,
    };
  }

  componentDidMount() {
    if (this.omitDashboardProp) {
      this.fetchDashboards();
    }
    this.handleDefaultFields();
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
    const widgetData: Widget = pick(this.state, [
      'title',
      'displayType',
      'interval',
      'queries',
      'widgetType',
    ]);
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
    const {closeModal, organization} = this.props;
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
        queryNames: string[];
        queryConditions: string[];
        queryFields: string[];
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
    const {closeModal, dashboard, onAddLibraryWidget} = this.props;
    if (!dashboard) {
      errors.dashboard = t('This field may not be blank');
      this.setState({errors});
      addErrorMessage(t('Widget may only be added to a Dashboard'));
    }

    if (!Object.keys(errors).length && dashboard && onAddLibraryWidget) {
      onAddLibraryWidget([...dashboard.widgets, widgetData]);
      closeModal();
    }
  };

  handleDefaultFields = () => {
    const {defaultWidgetQuery, defaultTableColumns} = this.props;
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      const displayType = prevState.displayType as Widget['displayType'];
      const normalized = normalizeQueries(displayType, prevState.queries);

      // If switching to Table visualization, use saved query fields for Y-Axis if user has not made query changes
      if (defaultWidgetQuery && defaultTableColumns && !prevState.userHasModified) {
        if (displayType === DisplayType.TABLE) {
          normalized.forEach(query => {
            query.fields = [...defaultTableColumns];
          });
        } else if (displayType === DisplayType.TOP_N) {
          normalized.forEach(query => {
            // Append Y-Axis to query.fields since TOP_N view assumes the last field is the Y-Axis
            query.fields = [...defaultTableColumns, defaultWidgetQuery.fields[0]];
            query.orderby = defaultWidgetQuery.orderby;
          });
        } else {
          normalized.forEach(query => {
            query.fields = [...defaultWidgetQuery.fields];
          });
        }
      }

      set(newState, 'queries', normalized);
      return {...newState, errors: undefined};
    });
  };

  handleFieldChange = (field: string) => (value: string) => {
    const {organization, source} = this.props;
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      set(newState, field, value);

      trackAdvancedAnalyticsEvent('dashboards_views.add_widget_modal.change', {
        from: source,
        field,
        value,
        widget_type: 'discover',
        organization,
      });

      return {...newState, errors: undefined};
    });

    if (field === 'displayType') {
      this.handleDefaultFields();
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
      const query = cloneDeep(newQuery);
      query.fields = this.state.queries[0].fields;
      newState.queries.push(query);

      return newState;
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
                  <components.Option
                    label={label}
                    data={data}
                    {...(optionProps as any)}
                  />
                </Tooltip>
              ),
            }}
          />
        </Field>
      </React.Fragment>
    );
  }

  render() {
    const {
      Footer,
      Body,
      Header,
      api,
      organization,
      selection,
      tags,
      widget: previousWidget,
      start,
      end,
      statsPeriod,
      dashboard,
      selectedWidgets,
      onUpdateWidget,
      onAddLibraryWidget,
    } = this.props;
    const state = this.state;
    const errors = state.errors;

    // Construct GlobalSelection object using statsPeriod/start/end props so we can render widget graph using saved timeframe from Saved/Prebuilt Query
    const querySelection: GlobalSelection = statsPeriod
      ? {...selection, datetime: {start: null, end: null, period: statsPeriod, utc: null}}
      : start && end
      ? {...selection, datetime: {start, end, period: '', utc: null}}
      : selection;
    const fieldOptions = (measurementKeys: string[]) =>
      generateFieldOptions({
        organization,
        tagKeys: Object.values(tags).map(({key}) => key),
        measurementKeys,
      });

    const isUpdatingWidget = typeof onUpdateWidget === 'function' && !!previousWidget;
    return (
      <React.Fragment>
        <Header closeButton>
          <h4>
            {this.omitDashboardProp
              ? t('Add Widget to Dashboard')
              : this.fromLibrary
              ? t('Add Custom Widget')
              : isUpdatingWidget
              ? t('Edit Widget')
              : t('Add Widget')}
          </h4>
        </Header>
        <Body>
          {this.omitDashboardProp && this.renderDashboardSelector()}
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
          <Measurements organization={organization}>
            {({measurements}) => {
              const measurementKeys = Object.values(measurements).map(({key}) => key);
              const amendedFieldOptions = fieldOptions(measurementKeys);
              return (
                <WidgetQueriesForm
                  organization={organization}
                  selection={querySelection}
                  fieldOptions={amendedFieldOptions}
                  displayType={state.displayType}
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
            api={api}
            organization={organization}
            selection={querySelection}
            widget={this.state}
            isEditing={false}
            onDelete={() => undefined}
            onEdit={() => undefined}
            renderErrorMessage={errorMessage =>
              typeof errorMessage === 'string' && (
                <PanelAlert type="error">{errorMessage}</PanelAlert>
              )
            }
            isSorting={false}
            currentWidgetDragging={false}
            noLazyLoad
          />
        </Body>
        <Footer>
          <StyledButtonBar gap={1}>
            <Button
              external
              href="https://docs.sentry.io/product/dashboards/custom-dashboards/#widget-builder"
            >
              {t('Read the docs')}
            </Button>
            <ButtonBar gap={1}>
              {this.fromLibrary && dashboard && onAddLibraryWidget ? (
                <Button
                  data-test-id="back-to-library"
                  type="button"
                  onClick={() => {
                    openDashboardWidgetLibraryModal({
                      organization,
                      dashboard,
                      customWidget: this.state,
                      initialSelectedWidgets: selectedWidgets,
                      onAddWidget: onAddLibraryWidget,
                    });
                  }}
                >
                  {t('Back to Library')}
                </Button>
              ) : null}
              <Button
                data-test-id="add-widget"
                priority="primary"
                type="button"
                onClick={this.handleSubmit}
                disabled={state.loading}
                busy={state.loading}
              >
                {this.fromLibrary
                  ? t('Confirm')
                  : isUpdatingWidget
                  ? t('Update Widget')
                  : t('Add Widget')}
              </Button>
            </ButtonBar>
          </StyledButtonBar>
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

const StyledButtonBar = styled(ButtonBar)`
  justify-content: space-between;
  width: 100%;
`;

export default withApi(withGlobalSelection(withTags(AddDashboardWidgetModal)));
