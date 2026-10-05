import {Fragment, type ReactNode, useMemo} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Flex} from '@sentry/scraps/layout';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {
  ConnectionModalFrame,
  LockedProjectField,
  LockedRepoField,
  getApiErrorMessage,
} from 'sentry/components/connectRepository/connectionModalFrame';
import {DEFAULT_BRANCH} from 'sentry/components/connectRepository/normalization';
import {PathMappingList} from 'sentry/components/connectRepository/pathMappingList';
import {
  editProjectRepoMappings,
  projectCodeMappingsOptions,
  useEditRepoInfo,
  useInvalidateRepoQueries,
} from 'sentry/components/connectRepository/queries';
import type {PathMappingValue} from 'sentry/components/connectRepository/type';
import {hasExactDuplicate} from 'sentry/components/connectRepository/warnings';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {RepositoryProjectPathConfig} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';

export type EditFormProps = ModalRenderProps & {
  externalId: string | null;
  integrationId: string | null;
  project: Pick<Project, 'id' | 'slug'>;
  providerKey: string | null;
  repoName: string;
  repositoryId: string;
  // When 'repo', the repo field is on the left and project on the right.
  // Defaults to 'project' (project on the left, repo on the right).
  lockedSide?: 'project' | 'repo';
};

// Inner component — only mounted once seeded mappings and the repo default
// branch are both ready. This lets useScrapsForm receive stable defaultValues.
interface EditRepositoryFormBodyProps extends Omit<EditFormProps, 'CloseButton'> {
  allMappings: RepositoryProjectPathConfig[];
  defaultBranch: string | null;
  invalidateQueries: () => Promise<unknown[]>;
  leftField: ReactNode;
  leftLabel: string;
  rightField: ReactNode;
  rightLabel: string;
  seededMappings: RepositoryProjectPathConfig[];
}

function EditRepositoryFormBody({
  Header,
  Body,
  Footer,
  closeModal,
  project,
  repositoryId,
  providerKey,
  integrationId,
  allMappings,
  seededMappings,
  defaultBranch,
  invalidateQueries,
  leftLabel,
  leftField,
  rightLabel,
  rightField,
}: EditRepositoryFormBodyProps) {
  const organization = useOrganization();

  const seededPathMappings: PathMappingValue[] =
    seededMappings.length > 0
      ? seededMappings.map(m => ({
          id: m.id,
          stackRoot: m.stackRoot,
          sourceRoot: m.sourceRoot,
          branch: m.defaultBranch ?? DEFAULT_BRANCH,
          hasCodeOwner: m.hasCodeOwner,
        }))
      : [{stackRoot: '', sourceRoot: '', branch: defaultBranch ?? DEFAULT_BRANCH}];

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      repository: null as string | null,
      pathMappings: seededPathMappings,
    },
    onSubmit: () => {},
  });

  const existingMappings = allMappings.filter(m => m.repoId !== repositoryId);

  const editMutation = useMutation({
    mutationFn: editProjectRepoMappings,
    onSuccess: async () => {
      await invalidateQueries();
      closeModal();
    },
  });

  return (
    <form.AppForm form={form}>
      <form.Subscribe selector={state => state.values.pathMappings}>
        {pathMappings => {
          const canSave =
            Boolean(integrationId) &&
            pathMappings.length > 0 &&
            !hasExactDuplicate(pathMappings, existingMappings);

          const alerts = (
            <Fragment>
              {editMutation.isError && (
                <Alert.Container>
                  <Alert variant="danger">{getApiErrorMessage(editMutation.error)}</Alert>
                </Alert.Container>
              )}
            </Fragment>
          );

          return (
            <ConnectionModalFrame
              Header={Header}
              Body={Body}
              Footer={Footer}
              closeModal={closeModal}
              title={t('Edit code mappings')}
              alerts={alerts}
              leftLabel={leftLabel}
              leftField={leftField}
              rightLabel={rightLabel}
              rightField={rightField}
              pathsSection={
                <Container paddingTop="2xl">
                  <PathMappingList
                    key={repositoryId}
                    form={form}
                    providerKey={providerKey ?? undefined}
                    defaultBranch={defaultBranch ?? undefined}
                    existingMappings={existingMappings}
                    projectSlug={project.slug}
                  />
                </Container>
              }
              canSave={canSave}
              isSaving={editMutation.isPending}
              onSave={() => {
                if (!seededMappings || !integrationId) {
                  return;
                }
                editMutation.mutate({
                  orgSlug: organization.slug,
                  project,
                  repositoryId,
                  integrationId,
                  seededMappings,
                  submittedMappings: pathMappings,
                });
              }}
            />
          );
        }}
      </form.Subscribe>
    </form.AppForm>
  );
}


export function EditRepositoryForm({
  Header,
  Body,
  Footer,
  closeModal,
  project,
  repositoryId,
  repoName,
  providerKey,
  integrationId,
  externalId,
  lockedSide = 'project',
}: EditFormProps) {
  const organization = useOrganization();
  const invalidateQueries = useInvalidateRepoQueries(organization.slug);

  const codeMappingsQuery = useQuery(
    projectCodeMappingsOptions({orgSlug: organization.slug, projectId: project.id})
  );

  const seededMappings = useMemo(
    () =>
      codeMappingsQuery.isSuccess
        ? (codeMappingsQuery.data ?? []).filter(m => m.repoId === repositoryId)
        : null,
    [codeMappingsQuery.isSuccess, codeMappingsQuery.data, repositoryId]
  );

  // undefined while mappings load so useEditRepoInfo doesn't fire the
  // integration-repos call prematurely; null once loaded but no branch set.
  const defaultBranchFromMappings = codeMappingsQuery.isSuccess
    ? (seededMappings?.[0]?.defaultBranch ?? null)
    : undefined;

  const {defaultBranch: repoDefaultBranch, isPending: isRepoInfoPending} =
    useEditRepoInfo({
      orgSlug: organization.slug,
      integrationId,
      externalId,
      repoName,
      defaultBranchFromMappings,
    });

  const isPending = codeMappingsQuery.isPending || isRepoInfoPending;

  const projectField = <LockedProjectField project={project} />;
  const repoFieldLocked = <LockedRepoField repoName={repoName} providerKey={providerKey} />;

  // lockedSide determines field order only; both are always locked in edit mode.
  const [leftLabel, leftField, rightLabel, rightField] =
    lockedSide === 'repo'
      ? [t('Repository'), repoFieldLocked, t('Project'), projectField]
      : [t('Project'), projectField, t('Repository'), repoFieldLocked];

  if (codeMappingsQuery.isError) {
    return (
      <ConnectionModalFrame
        Header={Header}
        Body={Body}
        Footer={Footer}
        closeModal={closeModal}
        title={t('Edit code mappings')}
        alerts={
          <Alert.Container>
            <Alert variant="danger">{t('Failed to load path mappings.')}</Alert>
          </Alert.Container>
        }
        leftLabel={leftLabel}
        leftField={leftField}
        rightLabel={rightLabel}
        rightField={rightField}
        pathsSection={null}
        canSave={false}
        isSaving={false}
        onSave={() => {}}
      />
    );
  }

  if (isPending || !seededMappings) {
    return (
      <ConnectionModalFrame
        Header={Header}
        Body={Body}
        Footer={Footer}
        closeModal={closeModal}
        title={t('Edit code mappings')}
        alerts={null}
        leftLabel={leftLabel}
        leftField={leftField}
        rightLabel={rightLabel}
        rightField={rightField}
        pathsSection={
          <Flex justify="center" padding="2xl">
            <LoadingIndicator mini />
          </Flex>
        }
        canSave={false}
        isSaving={false}
        onSave={() => {}}
      />
    );
  }

  return (
    <EditRepositoryFormBody
      Header={Header}
      Body={Body}
      Footer={Footer}
      closeModal={closeModal}
      project={project}
      repositoryId={repositoryId}
      repoName={repoName}
      providerKey={providerKey}
      integrationId={integrationId}
      externalId={externalId}
      allMappings={codeMappingsQuery.data ?? []}
      seededMappings={seededMappings}
      defaultBranch={repoDefaultBranch}
      invalidateQueries={() => invalidateQueries(project)}
      leftLabel={leftLabel}
      leftField={leftField}
      rightLabel={rightLabel}
      rightField={rightField}
    />
  );
}
