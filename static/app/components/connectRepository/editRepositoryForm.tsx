import {type ReactNode, useMemo} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import type {ModalRenderProps} from '@sentry/scraps/modal';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import type {RepositoryProjectPathConfig} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';

import {
  ConnectionModalFrame,
  LockedProjectField,
  LockedRepoField,
  ProjectTitleSubject,
  RepoTitleSubject,
  getApiErrorMessage,
} from './connectionModalFrame';
import {DEFAULT_BRANCH} from './normalization';
import {PathMappingList} from './pathMappingList';
import {
  editProjectRepoMappings,
  projectCodeMappingsOptions,
  useEditRepoInfo,
  useInvalidateRepoQueries,
} from './queries';
import type {PathMappingValue} from './type';
import {hasExactDuplicate} from './warnings';

export type EditFormProps = ModalRenderProps & {
  externalId: string | null;
  integrationId: string | null;
  project: Project;
  providerKey: string | null;
  repoName: string;
  repositoryId: string;
  // The side the modal was opened from: it is named in the title and the
  // other side is shown as a locked field. Defaults to 'project'.
  lockedSide?: 'project' | 'repo';
};

// Inner component — only mounted once seeded mappings and the repo default
// branch are both ready. This lets useScrapsForm receive stable defaultValues.
interface EditRepositoryFormBodyProps extends Omit<EditFormProps, 'CloseButton'> {
  allMappings: RepositoryProjectPathConfig[];
  defaultBranch: string | null;
  field: ReactNode;
  fieldLabel: string;
  invalidateQueries: () => Promise<unknown[]>;
  seededMappings: RepositoryProjectPathConfig[];
  title: ReactNode;
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
  title,
  fieldLabel,
  field,
}: EditRepositoryFormBodyProps) {
  const organization = useOrganization();

  const seededPathMappings: PathMappingValue[] = seededMappings.map(m => ({
    id: m.id,
    stackRoot: m.stackRoot,
    sourceRoot: m.sourceRoot,
    branch: m.defaultBranch ?? DEFAULT_BRANCH,
    automaticallyGenerated: m.automaticallyGenerated,
    hasCodeOwner: m.hasCodeOwner,
  }));

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      repository: null as string | null,
      pathMappings: seededPathMappings,
    },
    onSubmit: () => {},
  });

  const existingMappings = allMappings.filter(m => m.repoId !== repositoryId);

  const seededById = useMemo(
    () => new Map(seededMappings.map(m => [m.id, m])),
    [seededMappings]
  );

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
          // Allow saving zero mappings when there were seeded mappings to delete;
          // block save when nothing exists and nothing was added (no-op).
          const canSave =
            Boolean(integrationId) &&
            (pathMappings.length > 0 || seededMappings.length > 0) &&
            !hasExactDuplicate(pathMappings, existingMappings, seededById);

          const alerts = editMutation.isError && (
            <Alert.Container>
              <Alert variant="danger">{getApiErrorMessage(editMutation.error)}</Alert>
            </Alert.Container>
          );

          return (
            <ConnectionModalFrame
              Header={Header}
              Body={Body}
              Footer={Footer}
              closeModal={closeModal}
              title={title}
              alerts={alerts}
              fieldLabel={fieldLabel}
              field={field}
              pathsSection={
                <PathMappingList
                  key={repositoryId}
                  form={form}
                  allowEmpty
                  providerKey={providerKey ?? undefined}
                  defaultBranch={defaultBranch ?? undefined}
                  existingMappings={existingMappings}
                  seededById={seededById}
                  projectSlug={project.slug}
                  repositoryId={repositoryId}
                />
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

  // Both sides are locked in edit mode. The side the modal was opened from is
  // named in the title; the other side is shown as a locked field.
  const {title, fieldLabel, field} =
    lockedSide === 'repo'
      ? {
          title: tct('Edit code mappings for [subject]', {
            subject: <RepoTitleSubject repoName={repoName} providerKey={providerKey} />,
          }),
          fieldLabel: t('Project'),
          field: <LockedProjectField project={project} />,
        }
      : {
          title: tct('Edit code mappings for [subject]', {
            subject: <ProjectTitleSubject project={project} />,
          }),
          fieldLabel: t('Repository'),
          field: <LockedRepoField repoName={repoName} providerKey={providerKey} />,
        };

  if (codeMappingsQuery.isError) {
    return (
      <ConnectionModalFrame
        Header={Header}
        Body={Body}
        Footer={Footer}
        closeModal={closeModal}
        title={title}
        alerts={
          <Alert.Container>
            <Alert variant="danger">{t('Failed to load path mappings.')}</Alert>
          </Alert.Container>
        }
        fieldLabel={fieldLabel}
        field={field}
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
        title={title}
        alerts={null}
        fieldLabel={fieldLabel}
        field={field}
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
      title={title}
      fieldLabel={fieldLabel}
      field={field}
    />
  );
}
