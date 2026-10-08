import {useEffect, useState} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {ProjectAvatar} from '@sentry/scraps/avatar';
import {ScrapsForm} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {
  ConnectionModalFrame,
  LockedRepoField,
  getApiErrorMessage,
} from 'sentry/components/connectRepository/connectionModalFrame';
import {DEFAULT_BRANCH} from 'sentry/components/connectRepository/normalization';
import {PathMappingList} from 'sentry/components/connectRepository/pathMappingList';
import {
  orgProjectsOptions,
  projectCodeMappingsOptions,
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

import {useConnectRepoForm} from './useConnectRepoForm';

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
      <Flex justify="center">
        <Text variant="muted">{t('Select a project first to configure code paths')}</Text>
      </Flex>
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

  const saveMutation = useMutation({
    mutationFn: saveProjectRepoConnection,
    onSuccess: async () => {
      await invalidateQueries(selectedProject ?? undefined);
      closeModal();
    },
  });

  const form = useConnectRepoForm({
    defaultValues: {
      repository: null as string | null,
      pathMappings: [] as PathMappingValue[],
    },
    onSubmit: value => {
      if (
        !selectedProject ||
        !integrationId ||
        value.pathMappings.length === 0 ||
        isProjectsError ||
        codeMappingsPending ||
        codeMappingsError ||
        isBranchPending ||
        hasExactDuplicate(value.pathMappings, existingMappings)
      ) {
        return;
      }
      return saveMutation
        .mutateAsync({
          orgSlug: organization.slug,
          project: selectedProject,
          repositoryId,
          integrationId,
          pathMappings: value.pathMappings,
        })
        .then(() => {})
        .catch(() => {});
    },
  });

  const {
    data: projects = [],
    isPending: isProjectsPending,
    isError: isProjectsError,
  } = useQuery(orgProjectsOptions(organization.slug));

  // Repo-locked connect always needs a branch lookup since there are no
  // existing mappings to read the branch from.
  const {defaultBranch, isPending: isBranchPending} = useEditRepoInfo({
    orgSlug: organization.slug,
    integrationId,
    externalId,
    repoName,
    defaultBranchFromMappings: null,
  });

  // Seed exactly one blank row once the project is chosen AND the branch lookup
  // has settled. The form resets to [] on every project change so PathMappingList
  // stays unmounted (its row state is initialized once from form state).
  useEffect(() => {
    if (!selectedProject || isBranchPending) {
      return;
    }
    if (form.state.values.pathMappings.length > 0) {
      return;
    }
    form.setFieldValue('pathMappings', [
      {stackRoot: '', sourceRoot: '', branch: defaultBranch || DEFAULT_BRANCH},
    ]);
  }, [selectedProject, isBranchPending, defaultBranch, form]);

  // Fetch existing code mappings for the selected project so the save gate can
  // block on across-repo exact duplicates, consistent with the project-locked flow.
  const {
    data: projectCodeMappings,
    isPending: codeMappingsPending,
    isError: codeMappingsError,
  } = useQuery({
    ...projectCodeMappingsOptions({
      orgSlug: organization.slug,
      projectId: selectedProject?.id ?? '',
    }),
    enabled: Boolean(selectedProject),
  });

  const existingMappings = (projectCodeMappings ?? []).filter(
    m => m.repoId !== repositoryId
  );

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
        // Reset to empty; the useEffect above seeds a row once the branch resolves.
        form.setFieldValue('pathMappings', []);
        saveMutation.reset();
      }}
      placeholder={t('Search projects')}
      isLoading={isProjectsPending}
      searchable
      components={{MenuList: ScmVirtualizedMenuList}}
    />
  );

  return (
    <ScrapsForm form={form}>
      <form.Subscribe selector={state => state.values.pathMappings}>
        {pathMappings => {
          const canSave =
            selectedProject !== null &&
            pathMappings.length > 0 &&
            !isProjectsError &&
            !codeMappingsPending &&
            !codeMappingsError &&
            !hasExactDuplicate(pathMappings, existingMappings) &&
            Boolean(integrationId) &&
            !isBranchPending;

          const alerts = (
            <Stack gap="xs">
              {isProjectsError && (
                <Alert.Container>
                  <Alert variant="danger">
                    {t('Failed to load projects. Try again before connecting.')}
                  </Alert>
                </Alert.Container>
              )}
              {codeMappingsError && (
                <Alert.Container>
                  <Alert variant="danger">
                    {t('Failed to load existing path mappings. Try again before saving.')}
                  </Alert>
                </Alert.Container>
              )}
              {saveMutation.isError && (
                <Alert.Container>
                  <Alert variant="danger">{getApiErrorMessage(saveMutation.error)}</Alert>
                </Alert.Container>
              )}
            </Stack>
          );

          // Show a spinner until the project is chosen, the branch resolves, and
          // the initial row has been seeded into the form.
          const pathsSection =
            selectedProject && (isBranchPending || pathMappings.length === 0) ? (
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
            <ConnectionModalFrame
              Header={Header}
              Body={Body}
              Footer={Footer}
              closeModal={closeModal}
              title={title}
              intro={intro}
              alerts={alerts}
              leftLabel={t('Repository')}
              leftField={
                <LockedRepoField repoName={repoName} providerKey={providerKey} />
              }
              rightLabel={t('Project')}
              rightField={projectField}
              pathsSection={pathsSection}
              canSave={canSave}
              isSaving={saveMutation.isPending}
              saveButton={
                <form.SubmitButton disabled={!canSave}>{t('Save')}</form.SubmitButton>
              }
            />
          );
        }}
      </form.Subscribe>
    </ScrapsForm>
  );
}
