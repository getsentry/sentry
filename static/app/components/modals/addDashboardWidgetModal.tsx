import * as React from 'react';
import {browserHistory} from 'react-router';
import {css} from '@emotion/react';
import cloneDeep from 'lodash/cloneDeep';
import pick from 'lodash/pick';
import set from 'lodash/set';

import {validateWidget} from 'app/actionCreators/dashboards';
import {addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Button from 'app/components/button';
import DashboardWidgetBody from 'app/components/modals/dashboardWidgetLibraryModal/customTab';
import {t} from 'app/locale';
import {
  DateString,
  GlobalSelection,
  Organization,
  RelativePeriod,
  SelectValue,
  TagCollection,
} from 'app/types';
import {defined} from 'app/utils';
import trackAdvancedAnalyticsEvent from 'app/utils/analytics/trackAdvancedAnalyticsEvent';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withTags from 'app/utils/withTags';
import {DisplayType, Widget, WidgetQuery} from 'app/views/dashboardsV2/types';
import {
  mapErrors,
  normalizeQueries,
} from 'app/views/dashboardsV2/widget/eventWidget/utils';

import ButtonBar from '../buttonBar';

export type DashboardWidgetModalOptions = {
  organization: Organization;
  widget?: Widget;
  fromDiscover?: boolean;
  start?: DateString;
  end?: DateString;
  statsPeriod?: RelativePeriod | string;
  selection?: GlobalSelection;
  defaultWidgetQuery?: WidgetQuery;
  defaultTableColumns?: readonly string[];
  defaultTitle?: string;
  displayType?: DisplayType;
  onAddWidget?: (data: Widget) => void;
  onUpdateWidget?: (nextWidget: Widget) => void;
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
  userHasModified: boolean;
  selectedDashboard?: SelectValue<string>;
  loading: boolean;
  errors?: Record<string, any>;
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

    const {widget, defaultTitle, displayType, defaultWidgetQuery, fromDiscover} = props;
    if (!widget) {
      this.state = {
        title: defaultTitle ?? '',
        displayType: displayType ?? DisplayType.LINE,
        interval: '5m',
        queries: [defaultWidgetQuery ? {...defaultWidgetQuery} : {...newQuery}],
        userHasModified: false,
        errors: undefined,
        loading: !!fromDiscover,
      };
      return;
    }

    this.state = {
      title: widget.title,
      displayType: widget.displayType,
      interval: widget.interval,
      queries: normalizeQueries(widget.displayType, widget.queries),
      userHasModified: false,
      errors: undefined,
      loading: false,
    };
  }

  componentDidMount() {
    this.handleDefaultFields();
  }

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
    const {fromDiscover, organization} = this.props;
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      set(newState, field, value);

      trackAdvancedAnalyticsEvent('dashboards_views.add_widget_modal.change', {
        from: fromDiscover ? 'discoverv2' : 'dashboards',
        field,
        value,
        organization,
      });

      return {...newState};
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

      return {...newState};
    });
  };

  handleQueryRemove = (index: number) => {
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      newState.queries.splice(index, 1);

      return {...newState};
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

  handleDashboardChange = (option: SelectValue<string>) => {
    this.setState({selectedDashboard: option});
  };

  handleLoading = (loading: boolean) => {
    this.setState({loading});
  };

  handleErrors = (errors?: Record<string, any>) => {
    this.setState({errors});
  };

  handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const {
      api,
      closeModal,
      organization,
      onAddWidget,
      onUpdateWidget,
      widget: previousWidget,
      fromDiscover,
    } = this.props;
    let errors: FlatValidationError = {};
    const widgetData: Widget = pick(this.state, [
      'title',
      'displayType',
      'interval',
      'queries',
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
      } else if (onAddWidget) {
        onAddWidget(widgetData);
        addSuccessMessage(t('Added widget.'));
      }
      if (!fromDiscover) {
        closeModal();
      }
    } catch (err) {
      errors = mapErrors(err?.responseJSON ?? {}, {});
      this.setState({errors});
    } finally {
      this.setState({loading: false});
      if (fromDiscover) {
        this.handleSubmitFromDiscover(errors, widgetData);
      }
    }
  };

  handleSubmitFromDiscover = async (errors: FlatValidationError, widgetData: Widget) => {
    const {closeModal, organization} = this.props;
    const {selectedDashboard} = this.state;
    // Validate that a dashboard was selected since api call to /dashboards/widgets/ does not check for dashboard
    if (!selectedDashboard) {
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

  render() {
    const {
      Header,
      Body,
      Footer,
      organization,
      fromDiscover,
      api,
      tags,
      start,
      end,
      statsPeriod,
      selection,
      onUpdateWidget,
    } = this.props;
    const isUpdatingWidget = defined(onUpdateWidget);

    // Construct GlobalSelection object using statsPeriod/start/end props so we can render widget graph using saved timeframe from Saved/Prebuilt Query
    const querySelection: GlobalSelection = statsPeriod
      ? {...selection, datetime: {start: null, end: null, period: statsPeriod, utc: null}}
      : start && end
      ? {...selection, datetime: {start, end, period: '', utc: null}}
      : selection;

    return (
      <React.Fragment>
        <Header closeButton>
          <h4>
            {fromDiscover
              ? t('Add Widget to Dashboard')
              : isUpdatingWidget
              ? t('Edit Widget')
              : t('Add Widget')}
          </h4>
        </Header>
        <Body>
          <DashboardWidgetBody
            api={api}
            organization={organization}
            tags={tags}
            title={this.state.title}
            displayType={this.state.displayType}
            interval={this.state.interval}
            queries={this.state.queries}
            querySelection={querySelection}
            fromDiscover={fromDiscover}
            errors={this.state.errors}
            loading={this.state.loading}
            handleFieldChange={this.handleFieldChange}
            handleQueryChange={this.handleQueryChange}
            handleQueryRemove={this.handleQueryRemove}
            handleAddSearchConditions={this.handleAddSearchConditions}
            handleDashboardChange={this.handleDashboardChange}
            handleLoading={this.handleLoading}
            handleErrors={this.handleErrors}
          />
        </Body>
        <Footer>
          <ButtonBar gap={1}>
            <Button
              data-test-id="add-widget"
              priority="primary"
              type="button"
              onClick={this.handleSubmit}
              disabled={this.state.loading}
              busy={this.state.loading}
            >
              {isUpdatingWidget ? t('Update Widget') : t('Add Widget')}
            </Button>
          </ButtonBar>
        </Footer>
      </React.Fragment>
    );
  }
}

export const modalCss = css`
  width: 100%;
  max-width: 700px;
  margin: 70px auto;
`;

export default withApi(withGlobalSelection(withTags(AddDashboardWidgetModal)));
