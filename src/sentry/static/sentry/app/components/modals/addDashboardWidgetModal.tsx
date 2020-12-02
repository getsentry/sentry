import React from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import pick from 'lodash/pick';
import set from 'lodash/set';

import {validateWidget} from 'app/actionCreators/dashboards';
import {addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Button from 'app/components/button';
import WidgetQueryForm from 'app/components/dashboards/widgetQueryForm';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization, TagCollection} from 'app/types';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withTags from 'app/utils/withTags';
import {DISPLAY_TYPE_CHOICES, INTERVAL_CHOICES} from 'app/views/dashboardsV2/data';
import {DashboardListItem, Widget, WidgetQuery} from 'app/views/dashboardsV2/types';
import WidgetCard from 'app/views/dashboardsV2/widgetCard';
import {generateFieldOptions} from 'app/views/eventsV2/utils';
import SelectField from 'app/views/settings/components/forms/selectField';
import TextField from 'app/views/settings/components/forms/textField';

type Props = ModalRenderProps & {
  api: Client;
  organization: Organization;
  dashboard: DashboardListItem;
  selection: GlobalSelection;
  onAddWidget: (data: Widget) => void;
  tags: TagCollection;
};

type ValidationError = {
  [key: string]: string[] | ValidationError[] | ValidationError;
};

type FlatValidationError = {
  [key: string]: string | FlatValidationError[] | FlatValidationError;
};

type State = {
  title: string;
  displayType: Widget['displayType'];
  interval: Widget['interval'];
  queries: Widget['queries'];
  errors?: Record<string, any>;
  loading: boolean;
};

const newQuery = {
  name: '',
  fields: ['count()'],
  conditions: '',
};

function mapErrors(
  data: ValidationError,
  update: FlatValidationError
): FlatValidationError {
  Object.keys(data).forEach((key: string) => {
    const value = data[key];
    // Recurse into nested objects.
    if (Array.isArray(value) && typeof value[0] === 'string') {
      update[key] = value[0];
    } else if (Array.isArray(value) && typeof value[0] === 'object') {
      update[key] = (value as ValidationError[]).map(item => mapErrors(item, {}));
    } else {
      update[key] = mapErrors(value as ValidationError, {});
    }
  });

  return update;
}

class AddDashboardWidgetModal extends React.Component<Props, State> {
  state: State = {
    title: '',
    displayType: 'line',
    interval: '5m',
    queries: [{...newQuery}],
    errors: undefined,
    loading: false,
  };

  handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const {api, closeModal, organization, onAddWidget} = this.props;
    this.setState({loading: true});
    try {
      const widgetData: Widget = pick(this.state, [
        'title',
        'displayType',
        'interval',
        'queries',
      ]);
      await validateWidget(api, organization.slug, widgetData);
      onAddWidget(widgetData);
      addSuccessMessage(t('Added widget.'));
      closeModal();
    } catch (err) {
      const errors = mapErrors(err?.responseJSON ?? {}, {});
      this.setState({errors});
    } finally {
      this.setState({loading: false});
    }
  };

  handleAddQuery = (event: React.MouseEvent) => {
    event.preventDefault();

    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      newState.queries.push(cloneDeep(newQuery));

      return newState;
    });
  };

  handleFieldChange = (field: string) => (value: string) => {
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      set(newState, field, value);
      return newState;
    });
  };

  handleQueryChange = (widgetQuery: WidgetQuery, index: number) => {
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      set(newState, `queries.${index}`, widgetQuery);

      return newState;
    });
  };

  handleQueryRemove = (index: number) => {
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      newState.queries.splice(index, index + 1);

      return newState;
    });
  };

  render() {
    const {Body, Header, api, closeModal, organization, selection, tags} = this.props;
    const state = this.state;
    const errors = state.errors;

    // TODO(mark) Figure out how to get measurement keys here.
    const fieldOptions = generateFieldOptions({
      organization,
      tagKeys: Object.values(tags).map(({key}) => key),
      measurementKeys: [],
    });

    return (
      <React.Fragment>
        <Header closeButton onHide={closeModal}>
          {t('Add Widget')}
        </Header>
        <Body>
          <form>
            <Panel>
              <PanelHeader>{t('Widget Attributes')}</PanelHeader>
              <PanelBody>
                <TextField
                  name="title"
                  label={t('Title')}
                  required
                  value={state.title}
                  onChange={this.handleFieldChange('title')}
                  error={errors?.title}
                />
                <SelectField
                  name="interval"
                  label={t('Interval')}
                  help={t(
                    'The smallest resolution of data to use. May be increased for large time ranges.'
                  )}
                  options={INTERVAL_CHOICES.slice()}
                  value={state.interval}
                  onChange={this.handleFieldChange('interval')}
                  error={errors?.interval}
                />
                <SelectField
                  deprecatedSelectControl
                  required
                  options={DISPLAY_TYPE_CHOICES.slice()}
                  name="displayType"
                  label={t('Chart Style')}
                  value={state.displayType}
                  onChange={this.handleFieldChange('displayType')}
                  error={errors?.displayType}
                />
              </PanelBody>
            </Panel>
            <Panel>
              <PanelHeader>{t('Queries')}</PanelHeader>
              {state.queries.map((query, i) => {
                return (
                  <WidgetQueryForm
                    key={i}
                    api={api}
                    organization={organization}
                    selection={selection}
                    fieldOptions={fieldOptions}
                    widgetQuery={query}
                    canRemove={state.queries.length > 1}
                    onRemove={() => this.handleQueryRemove(i)}
                    onChange={(widgetQuery: WidgetQuery) =>
                      this.handleQueryChange(widgetQuery, i)
                    }
                    errors={errors?.queries?.[i]}
                  />
                );
              })}
              <AddQueryContainer>
                <Button
                  data-test-id="add-query"
                  priority="default"
                  type="button"
                  onClick={this.handleAddQuery}
                >
                  {t('Add Query')}
                </Button>
              </AddQueryContainer>
            </Panel>
            <Panel>
              <PanelHeader>{t('Preview')}</PanelHeader>
              <PanelItem>
                <WidgetCard
                  api={api}
                  organization={organization}
                  selection={selection}
                  widget={this.state}
                />
              </PanelItem>
            </Panel>
            <FooterButtons>
              <Button
                data-test-id="add-widget"
                priority="primary"
                type="button"
                onClick={this.handleSubmit}
                disabled={state.loading}
                busy={state.loading}
              >
                {t('Add Widget')}
              </Button>
            </FooterButtons>
          </form>
        </Body>
      </React.Fragment>
    );
  }
}

const FooterButtons = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

const AddQueryContainer = styled(FooterButtons)`
  padding: ${space(2)};
`;

export default withApi(withGlobalSelection(withTags(AddDashboardWidgetModal)));
