import {Fragment, useMemo, useState} from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Select, components} from '@sentry/scraps/select';
import type {SelectValue} from '@sentry/scraps/select';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {PathMappingList} from 'sentry/components/connectRepository/pathMappingList';
import type {PathMappingValue} from 'sentry/components/connectRepository/type';
import {ScmVirtualizedMenuList} from 'sentry/components/onboarding/scm/scmVirtualizedMenuList';
import {IconLock} from 'sentry/icons';
import {IconArrow} from 'sentry/icons/iconArrow';
import {t, tct} from 'sentry/locale';
import type {
  Integration,
  IntegrationRepository,
  Repository,
} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {fetchMutation} from 'sentry/utils/queryClient';
import {
  organizationRepositoriesInfiniteOptions,
  selectUniqueRepos,
} from 'sentry/utils/repositories/repoQueryOptions';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {projectRepoInfiniteOptions} from 'sentry/views/settings/projectGeneralSettings/projectRepoQueryOptions';

const REPOS_STALE_TIME_MS = 60_000;

type RepoSelectOption = SelectValue<string> & {
  integrationId: string;
  repositoryId: string;
  defaultBranch?: string | null;
  providerKey?: string;
};

type RepoGroup = {
  label: string;
  options: RepoSelectOption[];
};

interface Props extends ModalRenderProps {
  project: Project;
}

function scmIntegrationsOptions(orgSlug: string) {
  return apiOptions.as<Integration[]>()(
    '/organizations/$organizationIdOrSlug/integrations/',
    {
      path: {organizationIdOrSlug: orgSlug},
      query: {integrationType: 'source_code_management'},
      staleTime: REPOS_STALE_TIME_MS,
    }
  );
}

function integrationReposOptions(orgSlug: string, integrationId: string) {
  return apiOptions.as<{repos: IntegrationRepository[]}>()(
    '/organizations/$organizationIdOrSlug/integrations/$integrationId/repos/',
    {
      path: {organizationIdOrSlug: orgSlug, integrationId},
      staleTime: REPOS_STALE_TIME_MS,
    }
  );
}

function toPersistableOption(
  integration: Integration,
  repo: IntegrationRepository,
  sentryRepo: Repository | undefined
): RepoSelectOption | null {
  if (!sentryRepo) {
    return null;
  }
  return {
    value: `${integration.id}:${repo.identifier}`,
    label: repo.name,
    leadingItems: getIntegrationIcon(integration.provider.key, 'sm'),
    defaultBranch: repo.defaultBranch,
    providerKey: integration.provider.key,
    integrationId: integration.id,
    repositoryId: sentryRepo.id,
  };
}

function getApiErrorMessage(error: unknown) {
  if (error instanceof RequestError) {
    const detail = error.responseJSON?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (typeof detail?.message === 'string') {
      return detail.message;
    }
  }
  return t('Failed to connect repository');
}

function persistConnection({
  orgSlug,
  project,
  repositoryId,
  integrationId,
  pathMappings,
}: {
  integrationId: string;
  orgSlug: string;
  pathMappings: PathMappingValue[];
  project: Project;
  repositoryId: string;
}) {
  return fetchMutation({
    url: getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/repo/', {
      path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: project.slug},
    }),
    method: 'POST',
    data: {repositoryId},
  }).then(() =>
    Promise.all(
      pathMappings.map(mapping =>
        fetchMutation({
          url: getApiUrl('/organizations/$organizationIdOrSlug/code-mappings/', {
            path: {organizationIdOrSlug: orgSlug},
          }),
          method: 'POST',
          data: {
            integrationId,
            repositoryId,
            projectId: project.id,
            stackRoot: mapping.stackRoot,
            sourceRoot: mapping.sourceRoot,
            defaultBranch: mapping.branch,
          },
        })
      )
    )
  );
}

function useGroupedRepoOptions(orgSlug: string): {
  groupedOptions: RepoGroup[];
  isPending: boolean;
} {
  const organization = useOrganization();
  const {data: integrations = [], isPending: isIntegrationsPending} = useQuery(
    scmIntegrationsOptions(orgSlug)
  );

  const orgReposQuery = useInfiniteQuery({
    ...organizationRepositoriesInfiniteOptions({
      organization,
      query: {status: 'active', per_page: 100},
      staleTime: REPOS_STALE_TIME_MS,
    }),
    select: selectUniqueRepos,
  });
  useFetchAllPages({result: orgReposQuery});

  const sentryRepoByExternalId = useMemo(() => {
    const repos = orgReposQuery.data ?? [];
    return new Map(repos.map(repo => [repo.externalId, repo]));
  }, [orgReposQuery.data]);

  const activeIntegrations = useMemo(
    () =>
      integrations.filter(
        i => i.organizationIntegrationStatus === 'active' && i.status === 'active'
      ),
    [integrations]
  );

  const integrationRepoResults = useQueries({
    queries: activeIntegrations.map(i => integrationReposOptions(orgSlug, i.id)),
  });

  const groupedOptions = activeIntegrations.flatMap((integration, idx) => {
    const options = (integrationRepoResults[idx]?.data?.repos ?? []).flatMap(repo => {
      const option = toPersistableOption(
        integration,
        repo,
        sentryRepoByExternalId.get(repo.externalId)
      );
      return option ? [option] : [];
    });
    return options.length > 0 ? [{label: integration.name, options}] : [];
  });

  const isOrgReposPending =
    !orgReposQuery.isError &&
    (orgReposQuery.isPending ||
      orgReposQuery.isFetchingNextPage ||
      orgReposQuery.hasNextPage);

  return {
    groupedOptions,
    isPending:
      isIntegrationsPending ||
      integrationRepoResults.some(r => r.isPending) ||
      isOrgReposPending,
  };
}

function LockedProjectField({project}: {project: Project}) {
  return (
    <Select
      disabled
      aria-label={t('Project')}
      options={[
        {
          value: project.slug,
          label: project.slug,
          leadingItems: <ProjectAvatar project={project} size={16} />,
        },
      ]}
      value={project.slug}
      components={{
        DropdownIndicator: props => (
          <components.DropdownIndicator {...props}>
            <IconLock locked size="xs" />
          </components.DropdownIndicator>
        ),
      }}
    />
  );
}

function PathsPlaceholder() {
  return (
    <Container border="muted" radius="md" padding="2xl" style={{borderStyle: 'dashed'}}>
      <Flex justify="center">
        <Text variant="muted">
          {t('Select a repository first to configure code paths')}
        </Text>
      </Flex>
    </Container>
  );
}

export function ConnectRepositoryModal({
  Header,
  Body,
  Footer,
  closeModal,
  project,
}: Props) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const [selectedOption, setSelectedOption] = useState<RepoSelectOption | null>(null);
  const [pathMappings, setPathMappings] = useState<PathMappingValue[]>([]);
  const {groupedOptions, isPending} = useGroupedRepoOptions(organization.slug);

  const saveMutation = useMutation({
    mutationFn: persistConnection,
    onSuccess: async () => {
      await queryClient.invalidateQueries(
        projectRepoInfiniteOptions({
          orgSlug: organization.slug,
          projectSlug: project.slug,
        })
      );
      closeModal();
    },
  });

  const canSave = selectedOption !== null && pathMappings.length > 0;
  const saveError = saveMutation.isError ? getApiErrorMessage(saveMutation.error) : null;

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h4">
          {tct('Connect a repository to [project]', {project: project.slug})}
        </Heading>
      </Header>
      <Body>
        <Stack gap="xl">
          {saveError && (
            <Alert.Container>
              <Alert variant="danger">{saveError}</Alert>
            </Alert.Container>
          )}
          <Text as="p">
            {tct(
              'Link a repo to [project] so an error can take you straight to the line of code that caused it.',
              {
                project: (
                  <Text as="span" bold>
                    {project.slug}
                  </Text>
                ),
              }
            )}
          </Text>

          <Grid columns="1fr auto 1fr" gap="xs md" align="center">
            <Text size="sm" bold>
              {t('Project')}
            </Text>
            <Container />
            <Text size="sm" bold>
              {t('Repository')}
            </Text>
            <Container minWidth={0}>
              <LockedProjectField project={project} />
            </Container>
            <IconArrow direction="right" />
            <Container minWidth={0}>
              <Select
                aria-label={t('Repository')}
                options={groupedOptions}
                value={selectedOption?.value ?? null}
                onChange={option => {
                  setSelectedOption(option as RepoSelectOption | null);
                  setPathMappings([]);
                  saveMutation.reset();
                }}
                placeholder={t('Search repositories')}
                isLoading={isPending}
                searchable
                components={{MenuList: ScmVirtualizedMenuList}}
              />
            </Container>
          </Grid>

          {selectedOption ? (
            <Container paddingTop="2xl">
              <PathMappingList
                key={selectedOption.value}
                providerKey={selectedOption.providerKey}
                defaultBranch={selectedOption.defaultBranch ?? undefined}
                onChange={setPathMappings}
              />
            </Container>
          ) : (
            <Stack gap="xs" paddingTop="2xl">
              <Text size="sm" bold>
                {t('Paths')}
              </Text>
              <PathsPlaceholder />
            </Stack>
          )}
        </Stack>
      </Body>
      <Footer>
        <Flex justify="end" gap="md">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            variant="primary"
            disabled={!canSave || saveMutation.isPending}
            busy={saveMutation.isPending}
            onClick={() => {
              if (!selectedOption) {
                return;
              }
              saveMutation.mutate({
                orgSlug: organization.slug,
                project,
                repositoryId: selectedOption.repositoryId,
                integrationId: selectedOption.integrationId,
                pathMappings,
              });
            }}
          >
            {t('Save')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  );
}
