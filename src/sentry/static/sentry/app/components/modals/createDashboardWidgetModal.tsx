import React from 'react';
import {withRouter} from 'react-router';
import {WithRouterProps} from 'react-router/lib/withRouter';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import set from 'lodash/set';

import {addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Button from 'app/components/button';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import {GlobalSelection, Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import {DashboardListItem, Widget} from 'app/views/dashboardsV2/types';
import SelectField from 'app/views/settings/components/forms/selectField';
import TextField from 'app/views/settings/components/forms/textField';

type Props = ModalRenderProps &
  WithRouterProps & {
    api: Client;
    organization: Organization;
    dashboard: DashboardListItem;
    selection: GlobalSelection;
    onAddWidget: (data: Widget) => void;
  };

type State = {
  title: string;
  displayType: Widget['displayType'];
  queries: Widget['queries'];
};

const DISPLAY_TYPE_CHOICES = [
  {label: t('Area chart'), value: 'area'},
  {label: t('Bar chart'), value: 'bar'},
  {label: t('Line chart'), value: 'line'},
];

class CreateDashboardWidgetModal extends React.Component<Props, State> {
  state: State = {
    title: '',
    displayType: 'line',
    queries: [
      {
        name: '',
        fields: ['count()'],
        conditions: '',
        interval: '5m',
      },
    ],
  };

  handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const {closeModal, onAddWidget} = this.props;
    onAddWidget(this.state as Widget);
    addSuccessMessage(t('Added widget.'));
    closeModal();
  };

  handleFieldChange = (field: string) => (value: string) => {
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      set(newState, field, value);
      return newState;
    });
  };

  render() {
    const {Body, Header, closeModal} = this.props;
    const state = this.state;

    // TODO(mark) Expand query inputs to be more complete.
    // Currently missing is multiple fields and multiple queries.
    return (
      <React.Fragment>
        <Header closeButton onHide={closeModal}>
          {t('Add Widget')}
        </Header>
        <Body>
          <form onSubmit={this.handleSubmit}>
            <Panel>
              <PanelBody>
                <TextField
                  name="title"
                  label={t('Title')}
                  required
                  value={state.title}
                  onChange={this.handleFieldChange('title')}
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
              <PanelBody>
                <TextField
                  name="conditions"
                  label={t('Conditions')}
                  required
                  value={state.queries[0].conditions}
                  onChange={this.handleFieldChange('queries.0.conditions')}
                />
                <TextField
                  name="fields"
                  label={t('Fields')}
                  required
                  value={state.queries[0].fields[0]}
                  onChange={this.handleFieldChange('queries.0.fields.0')}
                />
              </PanelBody>
            </Panel>
            <FooterButtons>
              <Button priority="primary" type="button" onClick={this.handleSubmit}>
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

export default withApi(withGlobalSelection(withRouter(CreateDashboardWidgetModal)));
