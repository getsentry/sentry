import {useState} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {ProjectAvatar} from '@sentry/scraps/avatar';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {
  ConnectionModalFrame,
  LockedRepoField,
  getApiErrorMessage,
} from 'sentry/components/connectRepository/connectionModalFrame';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PathMappingList} from 'sentry/components/connectRepository/pathMappingList';
import type {PathMappingValue} from 'sentry/components/connectRepository/type';
import {hasExactDuplicate} from 'sentry/components/connectRepository/warnings';
import {t, tct} from 'sentry/locale';
import type {RepositoryProjectPathConfig} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ScmVirtualizedMenuList} from 'sentry/components/onboarding/scm/scmVirtualizedMenuList';
import {
  orgProjectsOptions,
  projectCodeMappingsOptions,
  saveProjectRepoConnection,
  useEditRepoInfo,
  useInvalidateRepoQueries,
} from 'sentry/components/connectRepository/queries';

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
      <Text variant="muted">
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
  const invalidateQueries = useInvalidateRepoQueries(organization.slug);

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      repository: null as string | null,
      pathMappings: [] as PathMappingValue[],
    },
    onSubmit: () => {},
  });

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

  // Fetch existing code mappings for the selected project so the save gate can
  // block on across-repo exact duplicates, consistent with project-locked flow.
  const {data: projectCodeMappings = []} = useQuery({
    ...projectCodeMappingsOptions({
      orgSlug: organization.slug,
      projectId: selectedProject?.id ?? '',
    }),
    enabled: Boolean(selectedProject),
  }) as {data: RepositoryProjectPathConfig[]};

  const existingMappings = projectCodeMappings.filter(m => m.repoId !== repositoryId);

  const saveMutation = useMutation({
    mutationFn: saveProjectRepoConnection,
    onSuccess: async () => {
      await invalidateQueries(selectedProject ?? undefined);
      closeModal();
    },
  });

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

  const projectOptions = buildProjectOptions(projects);

  const projectField = (
    <Select
      aria-label={t('Project')}
      options={projectOptions}
      value={selectedProject?.id ?? null}
      onChange={option => {
        const opt = option as (typeof projectOptions)[number] | null;
        setSelectedProject(opt?.project ?? null);
        form.setFieldValue('pathMappings', [
          {stackRoot: '', sourceRoot: '', branch: defaultBranch ?? ''},
        ]);
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
          form={form}
          providerKey={providerKey ?? undefined}
          defaultBranch={defaultBranch ?? undefined}
          existingMappings={existingMappings}
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
    <form.AppForm form={form}>
      <form.Subscribe selector={state => state.values.pathMappings}>
        {pathMappings => {
          const canSave =
            selectedProject !== null &&
            pathMappings.length > 0 &&
            !hasExactDuplicate(pathMappings, existingMappings) &&
            Boolean(integrationId) &&
            !isBranchPending;

          const alerts = saveMutation.isError ? (
            <Alert.Container>
              <Alert variant="danger">{getApiErrorMessage(saveMutation.error)}</Alert>
            </Alert.Container>
          ) : null;

          return (
            <ConnectionModalFrame
              Header={Header}
              Body={Body}
              Footer={Footer}
              closeModal={closeModal}
              title={title}
              intro={intro}
              alerts={alerts}
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
        }}
      </form.Subscribe>
    </form.AppForm>
  );
}
