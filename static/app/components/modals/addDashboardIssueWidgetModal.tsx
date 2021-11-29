import * as React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import set from 'lodash/set';

import {validateWidget} from 'sentry/actionCreators/dashboards';
import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import IssueWidgetQueriesForm from 'sentry/components/dashboards/issueWidgetQueriesForm';
import {PanelAlert} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {DateString, GlobalSelection, Organization, RelativePeriod} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import withApi from 'sentry/utils/withApi';
import withGlobalSelection from 'sentry/utils/withGlobalSelection';
import IssueWidgetCard from 'sentry/views/dashboardsV2/issueWidgetCard';
import {
  DisplayType,
  Widget,
  WidgetQuery,
  WidgetType,
} from 'sentry/views/dashboardsV2/types';
import {mapErrors} from 'sentry/views/dashboardsV2/widget/eventWidget/utils';
import Input from 'sentry/views/settings/components/forms/controls/input';
import Field from 'sentry/views/settings/components/forms/field';

export type DashboardIssueWidgetModalOptions = {
  organization: Organization;
  selection?: GlobalSelection;
  onAddWidget?: (data: Widget) => void;
  widget?: Widget;
  onUpdateWidget?: (nextWidget: Widget) => void;
  start?: DateString;
  end?: DateString;
  statsPeriod?: RelativePeriod | string;
};

type Props = ModalRenderProps &
  DashboardIssueWidgetModalOptions & {
    api: Client;
    organization: Organization;
    selection: GlobalSelection;
  };

type FlatValidationError = {
  [key: string]: string | FlatValidationError[] | FlatValidationError;
};

type State = {
  title: string;
  interval: Widget['interval'];
  queries: WidgetQuery[];
  loading: boolean;
  errors?: Record<string, any>;
  widgetType: WidgetType;
};

const newQuery = {
  name: '',
  fields: [] as string[],
  conditions: '',
  orderby: '',
};

class AddDashboardIssueWidgetModal extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    const {widget} = props;
    if (!widget) {
      this.state = {
        title: '',
        interval: '5m',
        queries: [{...newQuery}],
        errors: undefined,
        loading: false,
        widgetType: WidgetType.ISSUE,
      };
      return;
    }

    this.state = {
      title: widget.title,
      interval: widget.interval,
      queries: widget.queries,
      errors: undefined,
      loading: false,
      widgetType: WidgetType.ISSUE,
    };
  }

  handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const {
      api,
      organization,
      onAddWidget,
      onUpdateWidget,
      closeModal,
      widget: previousWidget,
    } = this.props;
    this.setState({loading: true});
    let errors: FlatValidationError = {};
    const widgetData: Widget = {
      title: this.state.title,
      interval: this.state.interval,
      queries: this.state.queries,
      displayType: DisplayType.TABLE,
      widgetType: this.state.widgetType,
    };
    try {
      await validateWidget(api, organization.slug, widgetData);
      if (defined(onUpdateWidget) && !!previousWidget) {
        onUpdateWidget({
          id: previousWidget?.id,
          ...widgetData,
        });
        addSuccessMessage(t('Updated widget.'));
      } else if (onAddWidget) {
        onAddWidget(widgetData);
        addSuccessMessage(t('Added widget.'));
      }
      closeModal();
    } catch (err) {
      errors = mapErrors(err?.responseJSON ?? {}, {});
      this.setState({errors});
    } finally {
      this.setState({loading: false});
    }
  };

  handleFieldChange = (field: string) => (value: string) => {
    const {organization} = this.props;
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      set(newState, field, value);

      trackAdvancedAnalyticsEvent('dashboards_views.add_widget_modal.change', {
        from: 'dashboards',
        field,
        value,
        widgetType: 'issue',
        organization,
      });

      return {...newState, errors: undefined};
    });
  };

  handleQueryChange = (widgetQuery: WidgetQuery) => {
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      set(newState, `queries`, [widgetQuery]);

      return {...newState, errors: undefined};
    });
  };

  render() {
    const {
      Footer,
      Body,
      Header,
      api,
      organization,
      selection,
      onUpdateWidget,
      widget: previousWidget,
      start,
      end,
      statsPeriod,
    } = this.props;
    const state = this.state;
    const errors = state.errors;

    // Construct GlobalSelection object using statsPeriod/start/end props so we can render widget graph using saved timeframe from Saved/Prebuilt Query
    const querySelection: GlobalSelection = statsPeriod
      ? {...selection, datetime: {start: null, end: null, period: statsPeriod, utc: null}}
      : start && end
      ? {...selection, datetime: {start, end, period: '', utc: null}}
      : selection;

    const isUpdatingWidget = defined(onUpdateWidget) && !!previousWidget;

    return (
      <React.Fragment>
        <Header closeButton>
          <h4>{isUpdatingWidget ? t('Edit Issue Widget') : t('Add Issue Widget')}</h4>
        </Header>
        <Body>
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
          <IssueWidgetQueriesForm
            organization={organization}
            selection={querySelection}
            query={state.queries[0]}
            error={errors?.queries?.[0]}
            onChange={(widgetQuery: WidgetQuery) => this.handleQueryChange(widgetQuery)}
          />
          <IssueWidgetCard
            api={api}
            organization={organization}
            selection={querySelection}
            widget={{...this.state, displayType: DisplayType.TABLE}}
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
          />
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

const StyledField = styled(Field)`
  position: relative;
`;

export default withApi(withGlobalSelection(AddDashboardIssueWidgetModal));
