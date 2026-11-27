import styled from '@emotion/styled';
import {IconOpen} from '@sentry/icons/open';
import {useMutation, useQuery} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {CopyToClipboardButton} from '@sentry/scraps/clipboard';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import {Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {List} from 'sentry/components/list';
import {t, tct} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {uniq} from 'sentry/utils/array/uniq';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

type DerivedCodeMapping = {
  filename: string;
  repo_branch: string;
  repo_name: string;
  source_path: string;
  stacktrace_root: string;
};

type RepoPathParsingResponse = {
  defaultBranch: string;
  integrationId: number;
  provider: string;
  repositoryId: number;
  sourceRoot: string;
  stackRoot: string;
};

const schema = z.object({sourceUrl: z.string()});

function firstMessage(value: unknown) {
  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined;
}

function getSubmitErrorMessage(error: Error) {
  const errorJson = error instanceof RequestError ? error.responseJSON : undefined;
  return (
    firstMessage(errorJson?.sourceUrl) ??
    firstMessage(errorJson?.nonFieldErrors) ??
    t('Unable to save configuration')
  );
}

function WrappingFilePath({path}: {path: string}) {
  const separatorIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const directory = path.slice(0, separatorIndex + 1);
  const basename = path.slice(separatorIndex + 1);

  return (
    <Text
      as="span"
      monospace
      wrap="pre-wrap"
      wordBreak="break-word"
      data-test-id="file-path"
    >
      {directory}
      <Text as="span" bold monospace variant="inherit">
        {basename}
      </Text>
    </Text>
  );
}

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

export function StacktraceLinkModal({
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
  const {data: suggestedCodeMappings} = useQuery({
    ...apiOptions.as<DerivedCodeMapping[] | null>()(
      '/organizations/$organizationIdOrSlug/derive-code-mappings/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          projectId: project.id,
          stacktraceFilename: filename,
          module,
          absPath,
          platform,
        },
        staleTime: Infinity,
      }
    ),
    refetchOnWindowFocus: false,
    retry: false,
    notifyOnChangeProps: ['data'],
  });

  const sourceCodeProviders = integrations.filter(integration =>
    ['github', 'gitlab', 'bitbucket'].includes(integration.provider?.key)
  );

  // If they have more than one, they'll have to navigate themselves
  const hasOneSourceCodeIntegration = sourceCodeProviders.length === 1;
  const sourceCodeIntegration = hasOneSourceCodeIntegration
    ? sourceCodeProviders[0]
    : undefined;
  const sourceUrl = hasOneSourceCodeIntegration
    ? `https://${sourceCodeIntegration!.domainName}`
    : undefined;
  const providerDisplayName = sourceCodeIntegration?.provider.name;

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
      const provider = sourceCodeIntegration;
      if (provider?.provider?.key === 'bitbucket') {
        return 'https://bitbucket.org/workspace/repository/src/main/path/to/file';
      }
      if (provider?.provider?.key === 'gitlab') {
        return 'https://gitlab.com/group/project/-/blob/main/path/to/file';
      }
    }
    return 'https://github.com/organization/repository/blob/main/path/to/file';
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

  const mutation = useMutation({
    mutationFn: async (fileUrl: string) => {
      const configData = await fetchMutation<RepoPathParsingResponse>({
        url: getApiUrl(
          '/projects/$organizationIdOrSlug/$projectIdOrSlug/repo-path-parsing/',
          {path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug}}
        ),
        method: 'POST',
        data: {sourceUrl: fileUrl, stackPath: filename, module, absPath, platform},
      });
      await fetchMutation({
        url: getApiUrl('/organizations/$organizationIdOrSlug/code-mappings/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        method: 'POST',
        data: {...configData, projectId: project.id},
      });
      return configData;
    },
    onSuccess: (configData, fileUrl) => {
      toast.success(t('Stack trace configuration saved.'));
      trackAnalytics('integrations.stacktrace_complete_setup', {
        setup_type: 'automatic',
        provider: configData.provider,
        view: 'stacktrace_issue_details',
        organization,
        is_suggestion: suggestions.includes(fileUrl),
      });
      closeModal();
      onSubmit();
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {sourceUrl: ''},
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      trackAnalytics('integrations.stacktrace_submit_config', {
        setup_type: 'automatic',
        view: 'stacktrace_issue_details',
        provider: sourceCodeProviders[0]?.provider.name ?? 'unknown',
        organization,
      });
      return mutation.mutateAsync(value.sourceUrl).catch(() => {});
    },
  });

  const error = mutation.error ? getSubmitErrorMessage(mutation.error) : null;

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <h4>{t('Set up Code Mapping')}</h4>
      </Header>
      <Body>
        <Stack gap="xl">
          {error && (
            <Alert variant="danger">
              {error === 'Could not find repo'
                ? tct(
                    'We can’t access this repository. [link:Add it] or use a URL from a connected repository.',
                    {
                      link: (
                        <Link
                          onClick={onManualSetup}
                          to={`/settings/${organization.slug}/repos/`}
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
            {hasOneSourceCodeIntegration
              ? tct(
                  'We couldn’t find the source file automatically. Paste its [provider] URL so we can link to the source and identify suspect commits.',
                  {provider: providerDisplayName}
                )
              : t(
                  'We couldn’t find the source file automatically. Paste its URL so we can link to the source and identify suspect commits.'
                )}
          </div>
          <StyledList symbol="colored-numeric">
            <li>
              <Stack
                flex="1"
                minWidth="0"
                marginTop="2xs"
                gap="md"
                maxWidth="calc(100% - 25px - 8px)"
              >
                <div>
                  {hasOneSourceCodeIntegration ? (
                    <ExternalLink href={sourceUrl}>
                      <Flex as="span" align="center" gap="xs">
                        {t(
                          'Open %s on %s',
                          sourceCodeIntegration!.name,
                          providerDisplayName
                        )}
                        <IconOpen size="xs" />
                      </Flex>
                    </ExternalLink>
                  ) : (
                    t('Open your source code provider')
                  )}
                </div>
              </Stack>
            </li>
            <li>
              <Stack
                flex="1"
                minWidth="0"
                marginTop="2xs"
                gap="md"
                maxWidth="calc(100% - 25px - 8px)"
              >
                <div>{t('Find the repository containing this file')}</div>
                <Grid
                  columns="minmax(0, 1fr) auto"
                  align="start"
                  gap="sm"
                  padding="md"
                  background="secondary"
                  border="primary"
                  radius="md"
                >
                  <WrappingFilePath path={filename} />
                  <CopyToClipboardButton
                    text={filename}
                    size="xs"
                    variant="transparent"
                    aria-label={t('Copy file path')}
                  />
                </Grid>
              </Stack>
            </li>
            <li>
              <Stack
                flex="1"
                minWidth="0"
                marginTop="2xs"
                gap="md"
                maxWidth="calc(100% - 25px - 8px)"
              >
                <div>
                  {suggestions.length
                    ? t('Copy a suggested URL or paste the file URL')
                    : t('Paste the file URL')}
                </div>
                {suggestions.length ? (
                  <Suggestions>
                    {suggestions.map((suggestion, i) => {
                      return (
                        <div key={i} style={{display: 'flex', alignItems: 'center'}}>
                          <SuggestionOverflow>{suggestion}</SuggestionOverflow>
                          <CopyToClipboardButton
                            variant="transparent"
                            text={suggestion}
                            size="xs"
                            aria-label={t('Copy suggestion to clipboard')}
                          />
                        </div>
                      );
                    })}
                  </Suggestions>
                ) : null}

                <form.AppField name="sourceUrl">
                  {field => (
                    <field.Input
                      aria-label={t('File URL')}
                      value={field.state.value}
                      onChange={field.handleChange}
                      placeholder={getPlaceholderUrl()}
                    />
                  )}
                </form.AppField>
              </Stack>
            </li>
          </StyledList>
        </Stack>
      </Body>
      <Footer>
        <Grid flow="column" align="center" gap="md">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <form.SubmitButton>{t('Save mapping')}</form.SubmitButton>
        </Grid>
      </Footer>
    </form.AppForm>
  );
}

const StyledList = styled(List)`
  gap: ${p => p.theme.space.xl};

  & > li {
    display: flex;
    padding-left: 0;
    gap: ${p => p.theme.space.md};
  }

  & > li:before {
    position: relative;
    min-width: 25px;
  }
`;

const Suggestions = styled('div')`
  background-color: ${p => p.theme.colors.surface200};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.md} ${p => p.theme.space.md}
    ${p => p.theme.space.xl};
`;

const SuggestionOverflow = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  direction: rtl;
`;
