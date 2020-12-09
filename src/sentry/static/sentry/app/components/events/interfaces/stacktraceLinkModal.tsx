import React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import Alert from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {IconInfo} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Integration, Organization, Project} from 'app/types';
import {getIntegrationIcon} from 'app/utils/integrationUtil';
import InputField from 'app/views/settings/components/forms/inputField';

type Props = AsyncComponent['props'] &
  ModalRenderProps & {
    filename: string;
    organization: Organization;
    project: Project;
    integrations: Integration[];
    onSubmit: () => void;
  };

type State = AsyncComponent['state'] & {
  sourceCodeInput: string;
};

class StacktraceLinkModal extends AsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      sourceCodeInput: '',
    };
  }

  onHandleChange(sourceCodeInput: string) {
    this.setState({
      sourceCodeInput,
    });
  }

  handleSubmit = async () => {
    const {sourceCodeInput} = this.state;
    const {organization, filename, project} = this.props;

    const parsingEndpoint = `/projects/${organization.slug}/${project.slug}/repo-path-parsing/`;
    try {
      const configData = await this.api.requestPromise(parsingEndpoint, {
        method: 'POST',
        data: {
          sourceUrl: sourceCodeInput,
          stackPath: filename,
        },
      });

      const configEndpoint = `/organizations/${organization.slug}/integrations/${configData.integrationId}/repo-project-path-configs/`;
      await this.api.requestPromise(configEndpoint, {
        method: 'POST',
        data: {...configData, projectId: project.id},
      });

      addSuccessMessage(t('Stack trace configuration saved.'));
      this.props.closeModal();
      this.props.onSubmit();
    } catch (err) {
      const errors = err?.responseJSON
        ? Array.isArray(err?.responseJSON)
          ? err?.responseJSON
          : Object.values(err?.responseJSON)
        : [];
      const apiErrors = errors.length > 0 ? `: ${errors.join(', ')}` : '';
      addErrorMessage(t('Something went wrong%s', apiErrors));
    }
  };

  renderBody() {
    const {sourceCodeInput} = this.state;
    const {Header, Body, Footer, filename, integrations, organization} = this.props;
    const baseUrl = `/settings/${organization.slug}/integrations`;

    return (
      <React.Fragment>
        <Header closeButton>{t('Link Your Stack Trace To Your Source Code')}</Header>
        <Body>
          <ModalContainer>
            <div>
              <h6>{t('Quick Setup')}</h6>
              {tct(
                'Enter in your source code url that corresponds to stack trace filename [filename]. We will use this information to automatically set up your stack trace linking configuration.',
                {
                  filename: <code>{filename}</code>,
                }
              )}
            </div>
            <SourceCodeInput>
              <StyledInputField
                inline={false}
                flexibleControlStateSize
                stacked
                name="source-code-input"
                type="text"
                value={sourceCodeInput}
                onChange={val => this.onHandleChange(val)}
                placeholder={t(
                  `https://github.com/helloworld/Hello-World/blob/master/${filename}`
                )}
              />
              <ButtonBar>
                <Button
                  data-test-id="quick-setup-button"
                  type="button"
                  onClick={() => this.handleSubmit()}
                >
                  {t('Submit')}
                </Button>
              </ButtonBar>
            </SourceCodeInput>
            <div>
              <h6>{t('Manual Setup')}</h6>
              <Alert type="warning">
                {t(
                  'Recommended for more complicated configurations such as having multiple repositories for the same Sentry project.'
                )}
              </Alert>
              {t(
                'To configure stack trace linking manually, select which of your following integrations you want to set up the mapping for:'
              )}
            </div>
            <ManualSetup>
              {integrations.map(integration => (
                <Button
                  key={integration.id}
                  type="button"
                  to={`${baseUrl}/${integration.provider.key}/${integration.id}/?tab=codeMappings`}
                >
                  {getIntegrationIcon(integration.provider.key)}
                  <IntegrationName>{integration.name}</IntegrationName>
                </Button>
              ))}
            </ManualSetup>
          </ModalContainer>
        </Body>
        <Footer>
          <Alert type="info" icon={<IconInfo />}>
            {tct(
              'Stack trace linking is still in Beta. If you have feedback, please email [email:ecosystem-feedback@sentry.io].',
              {email: <a href="mailto:ecosystem-feedback@sentry.io" />}
            )}
          </Alert>
        </Footer>
      </React.Fragment>
    );
  }
}

export default StacktraceLinkModal;

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
