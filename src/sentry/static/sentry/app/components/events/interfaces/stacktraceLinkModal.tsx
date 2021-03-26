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
  filename: string;
  integrations: Integration[];
  onSubmit: () => void;
  organization: Organization;
  project: Project;
};

type State = {
  sourceCodeInput: string;
};

class StacktraceLinkModal extends React.Component<Props, State> {
  state: State = {
    sourceCodeInput: '',
  };

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

  handleSubmit = async () => {
    const {sourceCodeInput} = this.state;
    const {api, closeModal, filename, onSubmit, organization, project} = this.props;
    trackIntegrationEvent(
      'integrations.stacktrace_submit_config',
      {
        setup_type: 'automatic',
        view: 'stacktrace_issue_details',
      },
      organization
    );

    const parsingEndpoint = `/projects/${organization.slug}/${project.slug}/repo-path-parsing/`;
    try {
      const configData = await api.requestPromise(parsingEndpoint, {
        method: 'POST',
        data: {
          sourceUrl: sourceCodeInput,
          stackPath: filename,
        },
      });

      const configEndpoint = `/organizations/${organization.slug}/repo-project-path-configs/`;
      await api.requestPromise(configEndpoint, {
        method: 'POST',
        data: {
          ...configData,
          projectId: project.id,
          integrationId: configData.integrationId,
        },
      });

      addSuccessMessage(t('Stack trace configuration saved.'));
      trackIntegrationEvent(
        'integrations.stacktrace_complete_setup',
        {
          setup_type: 'automatic',
          provider: configData.config?.provider.key,
          view: 'stacktrace_issue_details',
        },
        organization
      );
      closeModal();
      onSubmit();
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

  render() {
    const {sourceCodeInput} = this.state;
    const {Header, Body, Footer, filename, integrations, organization} = this.props;
    const baseUrl = `/settings/${organization.slug}/integrations`;

    return (
      <React.Fragment>
        <Header closeButton>{t('Link Stack Trace To Source Code')}</Header>
        <Body>
          <ModalContainer>
            <div>
              <h6>{t('Automatic Setup')}</h6>
              {tct(
                'Enter the source code URL corresponding to stack trace filename [filename] so we can automatically set up stack trace linking for this project.',
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
                  'We recommend this for more complicated configurations, like projects with multiple repositories.'
                )}
              </Alert>
              {t(
                "To manually configure stack trace linking, select the integration you'd like to use for mapping:"
              )}
            </div>
            <ManualSetup>
              {integrations.map(integration => (
                <Button
                  key={integration.id}
                  type="button"
                  onClick={() => this.onManualSetup(integration.provider.key)}
                  to={`${baseUrl}/${integration.provider.key}/${integration.id}/?tab=codeMappings&referrer=stacktrace-issue-details`}
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
            {tct('Got feedback? Email [email:ecosystem-feedback@sentry.io].', {
              email: <a href="mailto:ecosystem-feedback@sentry.io" />,
            })}
          </Alert>
        </Footer>
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

export default withApi(StacktraceLinkModal);
