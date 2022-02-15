import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import InputField from 'sentry/components/forms/inputField';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Integration, Organization, Project} from 'sentry/types';
import {
  getIntegrationIcon,
  trackIntegrationAnalytics,
} from 'sentry/utils/integrationUtil';
import withApi from 'sentry/utils/withApi';
import FeedbackAlert from 'sentry/views/settings/account/notifications/feedbackAlert';

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

class StacktraceLinkModal extends Component<Props, State> {
  state: State = {
    sourceCodeInput: '',
  };

  onHandleChange(sourceCodeInput: string) {
    this.setState({
      sourceCodeInput,
    });
  }

  onManualSetup(provider: string) {
    trackIntegrationAnalytics('integrations.stacktrace_manual_option_clicked', {
      view: 'stacktrace_issue_details',
      setup_type: 'manual',
      provider,
      organization: this.props.organization,
    });
  }

  handleSubmit = async () => {
    const {sourceCodeInput} = this.state;
    const {api, closeModal, filename, onSubmit, organization, project} = this.props;
    trackIntegrationAnalytics('integrations.stacktrace_submit_config', {
      setup_type: 'automatic',
      view: 'stacktrace_issue_details',
      organization,
    });

    const parsingEndpoint = `/projects/${organization.slug}/${project.slug}/repo-path-parsing/`;
    try {
      const configData = await api.requestPromise(parsingEndpoint, {
        method: 'POST',
        data: {
          sourceUrl: sourceCodeInput,
          stackPath: filename,
        },
      });

      const configEndpoint = `/organizations/${organization.slug}/code-mappings/`;
      await api.requestPromise(configEndpoint, {
        method: 'POST',
        data: {
          ...configData,
          projectId: project.id,
          integrationId: configData.integrationId,
        },
      });

      addSuccessMessage(t('Stack trace configuration saved.'));
      trackIntegrationAnalytics('integrations.stacktrace_complete_setup', {
        setup_type: 'automatic',
        provider: configData.config?.provider.key,
        view: 'stacktrace_issue_details',
        organization,
      });
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
    const {Header, Body, filename, integrations, organization} = this.props;
    const baseUrl = `/settings/${organization.slug}/integrations`;

    return (
      <Fragment>
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
            <StyledFeedbackAlert />
          </ModalContainer>
        </Body>
      </Fragment>
    );
  }
}

const SourceCodeInput = styled('div')`
  display: grid;
  grid-template-columns: 5fr 1fr;
  gap: ${space(1)};
`;

const ManualSetup = styled('div')`
  display: grid;
  gap: ${space(1)};
  justify-items: center;
`;

const ModalContainer = styled('div')`
  display: grid;
  gap: ${space(3)};

  code {
    word-break: break-word;
  }
`;

const StyledFeedbackAlert = styled(FeedbackAlert)`
  margin-bottom: 0;
`;

const StyledInputField = styled(InputField)`
  padding: 0px;
`;

const IntegrationName = styled('p')`
  padding-left: 10px;
`;

export default withApi(StacktraceLinkModal);
