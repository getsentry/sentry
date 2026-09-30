import {Fragment, useMemo, useState} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Container, Flex} from '@sentry/scraps/layout';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {DEFAULT_BRANCH} from 'sentry/components/connectRepository/normalization';
import {PathMappingList} from 'sentry/components/connectRepository/pathMappingList';
import type {PathMappingValue} from 'sentry/components/connectRepository/type';
import {hasExactDuplicate} from 'sentry/components/connectRepository/warnings';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  ConnectionModalFrame,
  LockedProjectField,
  LockedRepoField,
  getApiErrorMessage,
} from 'sentry/components/connectRepository/connectionModalFrame';
import {
  editProjectRepoMappings,
  projectCodeMappingsOptions,
  useEditRepoInfo,
  useInvalidateRepoQueries,
} from 'sentry/components/connectRepository/queries';

export type RepoLockedEditFormProps = ModalRenderProps & {
  externalId: string | null;
  integrationId: string | null;
  // The project to edit is resolved by the caller from the code-mappings cache
  // and passed in — both fields are locked in edit mode.
  project: Pick<Project, 'id' | 'slug'>;
  providerKey: string | null;
  repoName: string;
  repositoryId: string;
};

function buildPathsSection({
  isPending,
  seededPathMappings,
  listKey,
  providerKey,
  defaultBranch,
  projectSlug,
  onChange,
}: {
  isPending: boolean;
  listKey: string;
  onChange: (mappings: PathMappingValue[]) => void;
  providerKey: string | null;
  seededPathMappings: PathMappingValue[] | undefined;
  defaultBranch?: string;
  projectSlug?: string;
}) {
  if (isPending) {
    return (
      <Flex justify="center" padding="2xl">
        <LoadingIndicator mini />
      </Flex>
    );
  }
  if (!seededPathMappings) {
    return null;
  }
  return (
    <Container paddingTop="2xl">
      <PathMappingList
        key={listKey}
        providerKey={providerKey ?? undefined}
        defaultBranch={defaultBranch}
        projectSlug={projectSlug}
        pathMappings={seededPathMappings}
        onChange={onChange}
      />
    </Container>
  );
}

export function RepoLockedEditForm({
  Header,
  Body,
  Footer,
  closeModal,
  repositoryId,
  repoName,
  providerKey,
  integrationId,
  externalId,
  project,
}: RepoLockedEditFormProps) {
  const organization = useOrganization();
  const [pathMappings, setPathMappings] = useState<PathMappingValue[]>([]);
  const invalidateQueries = useInvalidateRepoQueries(organization.slug);

  const codeMappingsQuery = useQuery(
    projectCodeMappingsOptions({
      orgSlug: organization.slug,
      projectId: project.id,
    })
  );

  const seededMappings = useMemo(() => {
    if (!codeMappingsQuery.isSuccess) {
      return null;
    }
    return (codeMappingsQuery.data ?? []).filter(m => m.repoId === repositoryId);
  }, [codeMappingsQuery.isSuccess, codeMappingsQuery.data, repositoryId]);

  // undefined while mappings load; null once loaded but no branch found.
  const defaultBranchFromMappings = codeMappingsQuery.isSuccess
    ? (seededMappings?.[0]?.defaultBranch ?? null)
    : undefined;

  const {defaultBranch: repoDefaultBranch, isPending: isRepoInfoPending} = useEditRepoInfo(
    {
      orgSlug: organization.slug,
      integrationId,
      externalId,
      defaultBranchFromMappings,
    }
  );

  const editMutation = useMutation({
    mutationFn: editProjectRepoMappings,
    onSuccess: async () => {
      await invalidateQueries(project);
      closeModal();
    },
  });

  const canSave =
    codeMappingsQuery.isSuccess &&
    Boolean(integrationId) &&
    pathMappings.length > 0 &&
    !hasExactDuplicate(pathMappings);

  const seededPathMappings = seededMappings?.map(m => ({
    id: m.id,
    stackRoot: m.stackRoot,
    sourceRoot: m.sourceRoot,
    branch: m.defaultBranch ?? DEFAULT_BRANCH,
    hasCodeOwner: m.hasCodeOwner,
  }));

  const pathsSection = buildPathsSection({
    isPending: codeMappingsQuery.isPending || isRepoInfoPending,
    seededPathMappings,
    listKey: `${repositoryId}:${project.id}`,
    providerKey,
    defaultBranch: repoDefaultBranch ?? undefined,
    projectSlug: project.slug,
    onChange: setPathMappings,
  });

  const alerts = (
    <Fragment>
      {editMutation.isError && (
        <Alert.Container>
          <Alert variant="danger">{getApiErrorMessage(editMutation.error)}</Alert>
        </Alert.Container>
      )}
      {codeMappingsQuery.isError && (
        <Alert.Container>
          <Alert variant="danger">{t('Failed to load path mappings.')}</Alert>
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
      leftLabel={t('Repository')}
      leftField={<LockedRepoField repoName={repoName} providerKey={providerKey} />}
      rightLabel={t('Project')}
      rightField={<LockedProjectField project={project} />}
      pathsSection={pathsSection}
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
}
