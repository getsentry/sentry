import React from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import set from 'lodash/set';

import {addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Button from 'app/components/button';
import WidgetQueryForm from 'app/components/dashboards/widgetQueryForm';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization, TagCollection} from 'app/types';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withTags from 'app/utils/withTags';
import {DashboardListItem, Widget, WidgetQuery} from 'app/views/dashboardsV2/types';
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

type State = {
  title: string;
  displayType: Widget['displayType'];
  interval: Widget['interval'];
  queries: Widget['queries'];
};

const DISPLAY_TYPE_CHOICES = [
  {label: t('Area chart'), value: 'area'},
  {label: t('Bar chart'), value: 'bar'},
  {label: t('Line chart'), value: 'line'},
];

const INTERVAL_CHOICES = [
  {label: t('1 Minute'), value: '1m'},
  {label: t('5 Minutes'), value: '5m'},
  {label: t('1 Hour'), value: '1h'},
  {label: t('1 Day'), value: '1d'},
];

const newQuery = {
  name: '',
  fields: ['count()'],
  conditions: '',
};

class AddDashboardWidgetModal extends React.Component<Props, State> {
  state: State = {
    title: '',
    displayType: 'line',
    interval: '5m',
    queries: [{...newQuery}],
  };

  handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const {closeModal, onAddWidget} = this.props;
    onAddWidget(this.state as Widget);
    addSuccessMessage(t('Added widget.'));
    closeModal();
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
                />
                <SelectField
                  deprecatedSelectControl
                  required
                  options={DISPLAY_TYPE_CHOICES.slice()}
                  name="displayType"
                  label={t('Chart Style')}
                  value={state.displayType}
                  onChange={this.handleFieldChange('displayType')}
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
            <FooterButtons>
              <Button
                data-test-id="add-widget"
                priority="primary"
                type="button"
                onClick={this.handleSubmit}
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
