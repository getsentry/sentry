import {useState} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {
  ConnectionModalFrame,
  LockedRepoField,
  getApiErrorMessage,
} from 'sentry/components/connectRepository/connectionModalFrame';
import {PathMappingList} from 'sentry/components/connectRepository/pathMappingList';
import {
  orgProjectsOptions,
  saveProjectRepoConnection,
  useEditRepoInfo,
  useInvalidateRepoQueries,
} from 'sentry/components/connectRepository/queries';
import type {PathMappingValue} from 'sentry/components/connectRepository/type';
import {hasExactDuplicate} from 'sentry/components/connectRepository/warnings';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ScmVirtualizedMenuList} from 'sentry/components/onboarding/scm/scmVirtualizedMenuList';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';

export type RepoLockedConnectFormProps = ModalRenderProps & {
  externalId: string | null;
  integrationId: string | null;
  providerKey: string | null;
  repoName: string;
  repositoryId: string;
};

function PathsPlaceholder() {
  return (
    <Container border="muted" radius="md" padding="2xl" style={{borderStyle: 'dashed'}}>
      <Text as="div" align="center" variant="muted">
        {t('Select a project first to configure code paths')}
      </Text>
    </Container>
  );
}

function buildProjectOptions(projects: Project[]) {
  return projects.map(p => ({
    value: p.id,
    label: p.slug,
    leadingItems: <ProjectAvatar project={p} size={16} />,
    project: p,
  }));
}

export function RepoLockedConnectForm({
  Header,
  Body,
  Footer,
  closeModal,
  repositoryId,
  repoName,
  providerKey,
  integrationId,
  externalId,
}: RepoLockedConnectFormProps) {
  const organization = useOrganization();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [pathMappings, setPathMappings] = useState<PathMappingValue[]>([]);
  const invalidateQueries = useInvalidateRepoQueries(organization.slug);

  const {data: projects = [], isPending: isProjectsPending} = useQuery(
    orgProjectsOptions(organization.slug)
  );

  // Repo-locked connect always needs a branch lookup since there are no
  // existing mappings to read the branch from.
  const {defaultBranch, isPending: isBranchPending} = useEditRepoInfo({
    orgSlug: organization.slug,
    integrationId,
    externalId,
    repoName,
    defaultBranchFromMappings: null,
  });

  const saveMutation = useMutation({
    mutationFn: saveProjectRepoConnection,
    onSuccess: async () => {
      await invalidateQueries(selectedProject ?? undefined);
      closeModal();
    },
  });

  const canSave =
    selectedProject !== null &&
    pathMappings.length > 0 &&
    !hasExactDuplicate(pathMappings) &&
    Boolean(integrationId);

  const title = tct('Connect a project to [repo]', {repo: repoName});

  const intro = (
    <Text as="p">
      {tct(
        'Link a project to [repo] so an error can take you straight to the line of code that caused it.',
        {
          repo: (
            <Text as="span" bold>
              {repoName}
            </Text>
          ),
        }
      )}
    </Text>
  );

  const saveAlert = saveMutation.isError ? (
    <Alert.Container>
      <Alert variant="danger">{getApiErrorMessage(saveMutation.error)}</Alert>
    </Alert.Container>
  ) : null;

  const projectOptions = buildProjectOptions(projects);

  const projectField = (
    <Select
      aria-label={t('Project')}
      options={projectOptions}
      value={selectedProject?.id ?? null}
      onChange={option => {
        const opt = option as (typeof projectOptions)[number] | null;
        setSelectedProject(opt?.project ?? null);
        setPathMappings([]);
        saveMutation.reset();
      }}
      placeholder={t('Search projects')}
      isLoading={isProjectsPending}
      searchable
      components={{MenuList: ScmVirtualizedMenuList}}
    />
  );

  const pathsSection =
    selectedProject && isBranchPending ? (
      <Flex justify="center" paddingTop="2xl">
        <LoadingIndicator mini />
      </Flex>
    ) : selectedProject ? (
      <Container paddingTop="2xl">
        <PathMappingList
          key={selectedProject.id}
          providerKey={providerKey ?? undefined}
          defaultBranch={defaultBranch ?? undefined}
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
    );

  return (
    <ConnectionModalFrame
      Header={Header}
      Body={Body}
      Footer={Footer}
      closeModal={closeModal}
      title={title}
      intro={intro}
      alerts={saveAlert}
      leftLabel={t('Repository')}
      leftField={<LockedRepoField repoName={repoName} providerKey={providerKey} />}
      rightLabel={t('Project')}
      rightField={projectField}
      pathsSection={pathsSection}
      canSave={canSave}
      isSaving={saveMutation.isPending}
      onSave={() => {
        if (!selectedProject || !integrationId) {
          return;
        }
        saveMutation.mutate({
          orgSlug: organization.slug,
          project: selectedProject,
          repositoryId,
          integrationId,
          pathMappings,
        });
      }}
    />
  );
}
