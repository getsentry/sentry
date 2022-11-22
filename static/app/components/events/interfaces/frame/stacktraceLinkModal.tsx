import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import TextField from 'sentry/components/forms/fields/textField';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import List from 'sentry/components/list';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {Integration, Organization, Project} from 'sentry/types';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
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
  Footer,
}: StacktraceLinkModalProps) {
  const api = useApi();
  const [error, setError] = useState<null | string>(null);
  const [sourceCodeInput, setSourceCodeInput] = useState('');

  const onHandleChange = (input: string) => {
    setSourceCodeInput(input);
  };

  const sourceCodeProviders = integrations.filter(integration =>
    ['github', 'gitlab'].includes(integration.provider?.key)
  );
  // If they have more than one, they'll have to navigate themselves
  const hasOneSourceCodeIntegration = sourceCodeProviders.length === 1;
  const sourceUrl = hasOneSourceCodeIntegration
    ? `https://${sourceCodeProviders[0].domainName}`
    : undefined;
  const providerName = hasOneSourceCodeIntegration
    ? sourceCodeProviders[0].name
    : t('source code');

  const onManualSetup = () => {
    trackIntegrationAnalytics('integrations.stacktrace_manual_option_clicked', {
      view: 'stacktrace_issue_details',
      setup_type: 'manual',
      provider:
        sourceCodeProviders.length === 1
          ? sourceCodeProviders[0].provider.name
          : 'unknown',
      organization,
    });
  };

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
      const errorJson = err?.responseJSON || {};
      setError(
        errorJson.sourceUrl?.[0] ??
          errorJson.nonFieldErrors?.[0] ??
          t('Unable to save configuration')
      );
    }
  };

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Tell us where your source code is')}</h4>
      </Header>
      <Body>
        <ModalContainer>
          {error && (
            <StyledAlert type="error" showIcon>
              {error === 'Could not find repo'
                ? tct(
                    'We don’t have access to that [provider] repo. To fix this, [link:add your repo.]',
                    {
                      provider: providerName,
                      link: (
                        <Link
                          onClick={onManualSetup}
                          to={
                            hasOneSourceCodeIntegration
                              ? `/settings/${organization.slug}/integrations/${sourceCodeProviders[0].provider.name}/${sourceCodeProviders[0].id}/`
                              : `/settings/${organization.slug}/integrations/`
                          }
                        />
                      ),
                    }
                  )
                : error.includes('blank')
                ? t('URL is required.')
                : error}
            </StyledAlert>
          )}
          {tct(
            'We can’t find the file path for [filename] in your [provider] repo. Add the correct link below to enable git blame and suspect commits for this project.',
            {
              provider: providerName,
              filename: <StyledCode>{filename}</StyledCode>,
            }
          )}
          <StyledList symbol="colored-numeric">
            <li>
              <ItemContainer>
                {hasOneSourceCodeIntegration
                  ? tct('Go to [link]', {
                      link: (
                        <ExternalLink href={sourceUrl}>
                          {sourceCodeProviders[0].provider.name}
                        </ExternalLink>
                      ),
                    })
                  : t('Go to your source code provider')}
              </ItemContainer>
            </li>
            <li>
              <ItemContainer>
                <div>{t('Find the correct repo and path for the file')}</div>
                <TextCopyInput>{filename}</TextCopyInput>
              </ItemContainer>
            </li>
            <li>
              <ItemContainer>
                <StyledTextField
                  inline={false}
                  label={t('Copy the URL and paste it below')}
                  name="source-code-input"
                  value={sourceCodeInput}
                  onChange={onHandleChange}
                  placeholder={`https://github.com/helloworld/Hello-World/blob/master${
                    filename.startsWith('/') ? '' : '/'
                  }${filename}`}
                />
              </ItemContainer>
            </li>
          </StyledList>
        </ModalContainer>
      </Body>
      <Footer>
        <ButtonBar gap={1}>
          <Button type="button" onClick={closeModal}>
            {t('Cancel')}
          </Button>
          <Button type="button" priority="primary" onClick={handleSubmit}>
            {t('Save')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}

const StyledList = styled(List)`
  gap: ${space(2)};

  & > li {
    display: flex;
    padding-left: 0;
    gap: ${space(1)};
  }

  & > li:before {
    position: relative;
  }
`;

const ItemContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: column;
  margin-top: ${space(0.25)};
  flex: 1;
`;

const ModalContainer = styled('div')`
  display: grid;
  gap: ${space(2)};
`;

const StyledAlert = styled(Alert)`
  margin-bottom: 0;
`;

const StyledCode = styled('code')`
  word-break: break-word;
`;

const StyledTextField = styled(TextField)`
  padding: 0px;
  flex-grow: 1;

  div {
    margin-left: 0px;
  }
`;

export default StacktraceLinkModal;
