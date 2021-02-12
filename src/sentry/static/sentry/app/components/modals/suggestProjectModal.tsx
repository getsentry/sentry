import React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {IconInfo} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Integration, Organization, Project} from 'app/types';
import {getIntegrationIcon, trackIntegrationEvent} from 'app/utils/integrationUtil';
import withApi from 'app/utils/withApi';
import InputField from 'app/views/settings/components/forms/inputField';

type Props = ModalRenderProps & {
  api: Client;
  organization: Organization;
};

type State = {};

class SuggestProjectModal extends React.Component<Props, State> {
  state: State = {};

  onHandleChange(sourceCodeInput: string) {
    this.setState({
      sourceCodeInput,
    });
  }

  onManualSetup(provider: string) {
    trackIntegrationEvent(
      'integrations.stacktrace_manual_option_clicked',
      {
        view: 'stacktrace_issue_details',
        setup_type: 'manual',
        provider,
      },
      this.props.organization
    );
  }

  render() {
    const {Header, Body, Footer, organization} = this.props;

    return (
      <React.Fragment>
        <Header closeButton>{t('Link Stack Trace To Source Code')}</Header>
        <Body>
          <ModalContainer>
            <div>
              <h6>{t('Automatic Setup')}</h6>
              Hi
            </div>
          </ModalContainer>
        </Body>
        <Footer>Footer</Footer>
      </React.Fragment>
    );
  }
}

const SourceCodeInput = styled('div')`
  display: grid;
  grid-template-columns: 5fr 1fr;
  grid-gap: ${space(1)};
`;

const ManualSetup = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
  justify-items: center;
`;

const ModalContainer = styled('div')`
  display: grid;
  grid-gap: ${space(3)};

  code {
    word-break: break-word;
  }
`;

const StyledInputField = styled(InputField)`
  padding: 0px;
`;

const IntegrationName = styled('p')`
  padding-left: 10px;
`;

export default withApi(SuggestProjectModal);
