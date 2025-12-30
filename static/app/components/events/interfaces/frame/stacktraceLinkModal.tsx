import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {ExternalLink, Link} from 'sentry/components/core/link';
import TextField from 'sentry/components/forms/fields/textField';
import List from 'sentry/components/list';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Integration} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {uniq} from 'sentry/utils/array/uniq';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

type DerivedCodeMapping = {
  filename: string;
  repo_branch: string;
  repo_name: string;
  source_path: string;
  stacktrace_root: string;
};

interface StacktraceLinkModalProps extends ModalRenderProps {
  filename: string;
  integrations: Integration[];
  onSubmit: () => void;
  organization: Organization;
  project: Project;
  absPath?: string;
  module?: string;
  platform?: string;
}

function StacktraceLinkModal({
  closeModal,
  onSubmit,
  organization,
  integrations,
  filename,
  absPath,
  module,
  platform,
  project,
  Header,
  Body,
  Footer,
}: StacktraceLinkModalProps) {
  const api = useApi();
  const [error, setError] = useState<null | string>(null);
  const [sourceCodeInput, setSourceCodeInput] = useState('');

  const {data: suggestedCodeMappings} = useApiQuery<DerivedCodeMapping[] | null>(
    [
      `/organizations/${organization.slug}/derive-code-mappings/`,
      {
        query: {
          projectId: project.id,
          stacktraceFilename: filename,
          module,
          absPath,
          platform,
        },
      },
    ],
    {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      retry: false,
      notifyOnChangeProps: ['data'],
    }
  );

  const sourceCodeProviders = integrations.filter(integration =>
    ['github', 'gitlab', 'bitbucket'].includes(integration.provider?.key)
  );

  // If they have more than one, they'll have to navigate themselves
  const hasOneSourceCodeIntegration = sourceCodeProviders.length === 1;
  const sourceUrl = hasOneSourceCodeIntegration
    ? `https://${sourceCodeProviders[0]!.domainName}`
    : undefined;
  const providerName = hasOneSourceCodeIntegration
    ? sourceCodeProviders[0]!.name
    : t('source code');

  const suggestions = uniq(
    Array.isArray(suggestedCodeMappings)
      ? suggestedCodeMappings.map(suggestion => {
          if (hasOneSourceCodeIntegration) {
            const provider = sourceCodeProviders[0];
            if (provider?.provider?.key === 'bitbucket') {
              return `https://bitbucket.org/${suggestion.repo_name}/src/${suggestion.repo_branch}/${suggestion.filename}`;
            }
            if (provider?.provider?.key === 'gitlab') {
              return `https://gitlab.com/${suggestion.repo_name}/-/blob/${suggestion.repo_branch}/${suggestion.filename}`;
            }
          }
          return `https://github.com/${suggestion.repo_name}/blob/${suggestion.repo_branch}/${suggestion.filename}`;
        })
      : []
  ).slice(0, 2);

  const getPlaceholderUrl = () => {
    if (hasOneSourceCodeIntegration) {
      const provider = sourceCodeProviders[0];
      if (provider?.provider?.key === 'bitbucket') {
        return `https://bitbucket.org/workspace/repo/src/branch${
          filename.startsWith('/') ? '' : '/'
        }${filename}`;
      }
      if (provider?.provider?.key === 'gitlab') {
        return `https://gitlab.com/group/project/-/blob/branch${
          filename.startsWith('/') ? '' : '/'
        }${filename}`;
      }
    }
    return `https://github.com/helloworld/Hello-World/blob/master${
      filename.startsWith('/') ? '' : '/'
    }${filename}`;
  };

  const onHandleChange = (input: string) => {
    setSourceCodeInput(input);
  };

  const onManualSetup = () => {
    trackAnalytics('integrations.stacktrace_manual_option_clicked', {
      view: 'stacktrace_issue_details',
      setup_type: 'manual',
      provider:
        sourceCodeProviders.length === 1
          ? sourceCodeProviders[0]!.provider.name
          : 'unknown',
      organization,
    });
  };

  const handleSubmit = async () => {
    trackAnalytics('integrations.stacktrace_submit_config', {
      setup_type: 'automatic',
      view: 'stacktrace_issue_details',
      provider: sourceCodeProviders[0]?.provider.name ?? 'unknown',
      organization,
    });
    const parsingEndpoint = `/projects/${organization.slug}/${project.slug}/repo-path-parsing/`;
    try {
      const configData = await api.requestPromise(parsingEndpoint, {
        method: 'POST',
        data: {
          sourceUrl: sourceCodeInput,
          stackPath: filename,
          module,
          absPath,
          platform,
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
      trackAnalytics('integrations.stacktrace_complete_setup', {
        setup_type: 'automatic',
        provider: configData.config?.provider.key,
        view: 'stacktrace_issue_details',
        organization,
        is_suggestion: suggestions.includes(sourceCodeInput),
      });
      closeModal();
      onSubmit();
    } catch (err: any) {
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
        <h4>{t('Set up Code Mapping')}</h4>
      </Header>
      <Body>
        <ModalContainer>
          {error && (
            <Alert variant="danger">
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
                              ? `/settings/${organization.slug}/integrations/${sourceCodeProviders[0]!.provider.key}/${sourceCodeProviders[0]!.id}/`
                              : `/settings/${organization.slug}/integrations/`
                          }
                        />
                      ),
                    }
                  )
                : error.includes('blank')
                  ? t('URL is required.')
                  : error}
            </Alert>
          )}
          <div>
            {tct(
              'We can’t find the file path for [filename] in your [provider] repo. Add the correct link below to enable git blame and suspect commits for this project.',
              {
                provider: providerName,
                filename: <StyledCode>{filename}</StyledCode>,
              }
            )}
          </div>
          <StyledList symbol="colored-numeric">
            <li>
              <ItemContainer>
                <div>
                  {hasOneSourceCodeIntegration
                    ? tct('Go to [link]', {
                        link: (
                          <ExternalLink href={sourceUrl}>
                            {sourceCodeProviders[0]!.provider.name}
                          </ExternalLink>
                        ),
                      })
                    : t('Go to your source code provider')}
                </div>
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
                <div>
                  {suggestions.length
                    ? t('Select from one of these suggestions or paste your URL below')
                    : t('Copy the URL and paste it below')}
                </div>
                {suggestions.length ? (
                  <Suggestions>
                    {suggestions.map((suggestion, i) => {
                      return (
                        <div key={i} style={{display: 'flex', alignItems: 'center'}}>
                          <SuggestionOverflow>{suggestion}</SuggestionOverflow>
                          <CopyToClipboardButton
                            borderless
                            text={suggestion}
                            size="xs"
                            aria-label={t('Copy suggestion to clipboard')}
                          />
                        </div>
                      );
                    })}
                  </Suggestions>
                ) : null}

                <StyledTextField
                  inline={false}
                  aria-label={t('Repository URL')}
                  hideLabel
                  name="source-code-input"
                  value={sourceCodeInput}
                  onChange={onHandleChange}
                  placeholder={getPlaceholderUrl()}
                />
              </ItemContainer>
            </li>
          </StyledList>
        </ModalContainer>
      </Body>
      <Footer>
        <ButtonBar>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button priority="primary" onClick={handleSubmit}>
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
    min-width: 25px;
  }
`;

const Suggestions = styled('div')`
  background-color: ${p => p.theme.colors.surface200};
  border-radius: ${p => p.theme.radius.md};
  padding: ${space(1)} ${space(1)} ${space(1)} ${space(2)};
`;

const SuggestionOverflow = styled('div')`
  ${p => p.theme.overflowEllipsis};
  direction: rtl;
`;

const ItemContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: column;
  margin-top: ${space(0.25)};
  flex: 1;
  max-width: calc(100% - 25px - 8px);
`;

const ModalContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
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
