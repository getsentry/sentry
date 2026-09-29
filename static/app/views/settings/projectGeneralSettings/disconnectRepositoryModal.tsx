import {Fragment, useMemo} from 'react';
import {useInfiniteQuery, useMutation} from '@tanstack/react-query';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {DEFAULT_BRANCH} from 'sentry/components/connectRepository/normalization';
import {PathMappingList} from 'sentry/components/connectRepository/pathMappingList';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconDelete, IconLinkBroken} from 'sentry/icons';
import {t, tn, tct} from 'sentry/locale';
import type {RepositoryProjectPathConfig} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  disconnectProjectRepoMappings,
  orgCodeMappingsInfiniteOptions,
  useInvalidateRepoQueries,
} from 'sentry/views/settings/projectGeneralSettings/queries';

export type DisconnectRepositoryModalProps = ModalRenderProps & {
  project: Project;
  providerKey: string | null;
  repoName: string;
  repositoryId: string;
};

function IdentityRow({
  repoName,
  providerKey,
  project,
}: {
  project: Project;
  providerKey: string | null;
  repoName: string;
}) {
  return (
    <Flex justify="center" align="center" gap="xl" padding="md">
      <Stack align="center" gap="xs">
        {getIntegrationIcon(providerKey ?? undefined, 'lg')}
        <Text bold>{repoName}</Text>
        <Text size="sm" variant="muted">
          {t('Repository')}
        </Text>
      </Stack>

      <Container>
        {props => <IconLinkBroken size="lg" variant="muted" {...props} />}
      </Container>

      <Stack align="center" gap="xs">
        <ProjectAvatar project={project} size={32} />
        <Text bold>{project.slug}</Text>
        <Text size="sm" variant="muted">
          {t('Project')}
        </Text>
      </Stack>
    </Flex>
  );
}

function StillConnectedSection({slugs}: {slugs: string[]}) {
  if (slugs.length === 0) {
    return null;
  }
  return (
    <Stack gap="sm">
      <Text size="sm" bold variant="muted">
        {t('STILL CONNECTED TO THIS REPOSITORY')}
      </Text>
      <Flex gap="xs" wrap="wrap">
        {slugs.map(slug => (
          <Tag key={slug} variant="muted">
            {slug}
          </Tag>
        ))}
      </Flex>
    </Stack>
  );
}

export function DisconnectRepositoryModal({
  Header,
  Body,
  Footer,
  closeModal,
  project,
  providerKey,
  repoName,
  repositoryId,
}: DisconnectRepositoryModalProps) {
  const organization = useOrganization();
  const invalidateQueries = useInvalidateRepoQueries(
    organization.slug,
    project.slug,
    project.id
  );

  const orgMappingsQuery = useInfiniteQuery(
    orgCodeMappingsInfiniteOptions(organization.slug)
  );
  useFetchAllPages({result: orgMappingsQuery});

  const {removingMappings, stillConnectedSlugs} = useMemo(() => {
    const allMappings: RepositoryProjectPathConfig[] =
      orgMappingsQuery.data?.pages.flatMap(p => p.json) ?? [];
    const removing = allMappings.filter(
      m => m.repoId === repositoryId && m.projectId === project.id
    );
    const seen = new Set<string>();
    const connected: string[] = [];
    for (const m of allMappings) {
      if (
        m.repoId === repositoryId &&
        m.projectId !== project.id &&
        !seen.has(m.projectSlug)
      ) {
        seen.add(m.projectSlug);
        connected.push(m.projectSlug);
      }
    }
    return {removingMappings: removing, stillConnectedSlugs: connected};
  }, [orgMappingsQuery.data, repositoryId, project.id]);

  const isLoading =
    orgMappingsQuery.isPending ||
    orgMappingsQuery.isFetchingNextPage ||
    orgMappingsQuery.hasNextPage;

  const disconnectMutation = useMutation({
    mutationFn: () => disconnectProjectRepoMappings(organization.slug, removingMappings),
    onSuccess: async () => {
      await invalidateQueries();
      closeModal();
    },
    onError: (error: unknown) => {
      if (error instanceof RequestError && error.status === 409) {
        addErrorMessage(
          t(
            'One or more path mappings are used by a Code Owner rule and cannot be removed. Delete the Code Owner rule first.'
          )
        );
        return;
      }
      addErrorMessage(t('Failed to disconnect repository.'));
    },
  });

  const removingPathMappings = removingMappings.map(m => ({
    id: m.id,
    stackRoot: m.stackRoot,
    sourceRoot: m.sourceRoot,
    branch: m.defaultBranch ?? DEFAULT_BRANCH,
    hasCodeOwner: m.hasCodeOwner,
  }));

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h4">
          {tct('Disconnect [repo] from [project]?', {
            repo: repoName,
            project: project.slug,
          })}
        </Heading>
      </Header>

      <Body>
        <Stack gap="xl">
          <IdentityRow repoName={repoName} providerKey={providerKey} project={project} />

          <Text>
            {tct(
              'This will also remove the [count] between them. Stack traces in [project] will stop linking to [repo], and the suspect commits and source context that rely on it will stop.',
              {
                count: (
                  <strong>
                    {tn('%s path mapping', '%s path mappings', removingMappings.length)}
                  </strong>
                ),
                project: <strong>{project.slug}</strong>,
                repo: <strong>{repoName}</strong>,
              }
            )}
          </Text>

          {isLoading ? (
            <Flex justify="center" padding="xl">
              <LoadingIndicator mini />
            </Flex>
          ) : (
            <Fragment>
              <StillConnectedSection slugs={stillConnectedSlugs} />
              {removingPathMappings.length > 0 && (
                <Stack gap="sm">
                  <Text size="sm" bold variant="muted">
                    {t('REMOVING')}
                  </Text>
                  <PathMappingList
                    pathMappings={removingPathMappings}
                    hideActions
                    title={null}
                    onChange={() => {}}
                  />
                </Stack>
              )}
            </Fragment>
          )}
        </Stack>
      </Body>

      <Footer>
        <Flex justify="end" gap="md">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            variant="danger"
            icon={<IconDelete />}
            disabled={isLoading || disconnectMutation.isPending}
            busy={disconnectMutation.isPending}
            onClick={() => disconnectMutation.mutate()}
          >
            {t('Disconnect')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  );
}
