import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import TextField from 'sentry/components/forms/fields/textField';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {Integration, Organization, Project} from 'sentry/types';
import {
  getIntegrationIcon,
  trackIntegrationAnalytics,
} from 'sentry/utils/integrationUtil';
import useApi from 'sentry/utils/useApi';

interface StacktraceLinkModalProps extends ModalRenderProps {
  filename: string;
  integrations: Integration[];
  onSubmit: () => void;
  organization: Organization;
  project: Project;
}

function StacktraceLinkModal({
  closeModal,
  onSubmit,
  organization,
  integrations,
  filename,
  project,
  Header,
  Body,
}: StacktraceLinkModalProps) {
  const api = useApi();
  const [sourceCodeInput, setSourceCodeInput] = useState('');

  const onHandleChange = (input: string) => {
    setSourceCodeInput(input);
  };

  function onManualSetup(provider: string) {
    trackIntegrationAnalytics('integrations.stacktrace_manual_option_clicked', {
      view: 'stacktrace_issue_details',
      setup_type: 'manual',
      provider,
      organization,
    });
  }

  const handleSubmit = async () => {
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

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Link Stack Trace To Source Code')}</h4>
      </Header>
      <Body>
        <ModalContainer>
          <div>
            <h6>{t('Automatic Setup')}</h6>
            {tct(
              'Enter the source code URL corresponding to stack trace filename [filename] so we can automatically set up stack trace linking for this project.',
              {
                filename: <StyledCode>{filename}</StyledCode>,
              }
            )}
          </div>
          <SourceCodeInput>
            <StyledTextField
              inline={false}
              flexibleControlStateSize
              stacked
              name="source-code-input"
              value={sourceCodeInput}
              onChange={onHandleChange}
              placeholder={`https://github.com/helloworld/Hello-World/blob/master/${filename}`}
            />
            <Button type="button" onClick={handleSubmit}>
              {t('Submit')}
            </Button>
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
                onClick={() => onManualSetup(integration.provider.key)}
                to={{
                  pathname: `/settings/${organization.slug}/integrations/${integration.provider.key}/${integration.id}/`,
                  query: {tab: 'codeMappings', referrer: 'stacktrace-issue-details'},
                }}
              >
                {getIntegrationIcon(integration.provider.key)}
                <IntegrationName>{integration.name}</IntegrationName>
              </Button>
            ))}
          </ManualSetup>
        </ModalContainer>
      </Body>
    </Fragment>
  );
}

const ModalContainer = styled('div')`
  display: grid;
  gap: ${space(3)};
`;

const StyledCode = styled('code')`
  word-break: break-word;
`;

const SourceCodeInput = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const ManualSetup = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: column;
  align-items: center;
`;

const StyledTextField = styled(TextField)`
  padding: 0px;
  flex-grow: 1;
`;

const IntegrationName = styled('p')`
  padding-left: 10px;
`;

export default StacktraceLinkModal;
