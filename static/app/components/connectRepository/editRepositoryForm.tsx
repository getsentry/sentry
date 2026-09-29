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
  getApiErrorMessage,
  ConnectionModalFrame,
  LockedProjectField,
  LockedRepoField,
} from 'sentry/components/connectRepository/connectionModalFrame';
import {
  editProjectRepoMappings,
  projectCodeMappingsOptions,
  useEditRepoInfo,
  useInvalidateRepoQueries,
} from 'sentry/components/connectRepository/queries';

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

export type EditFormProps = ModalRenderProps & {
  externalId: string | null;
  integrationId: string | null;
  project: Project;
  providerKey: string | null;
  repoName: string;
  repositoryId: string;
};

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
}: EditFormProps) {
  const organization = useOrganization();
  const [pathMappings, setPathMappings] = useState<PathMappingValue[]>([]);
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

  // undefined while mappings are loading so useEditRepoInfo doesn't fire the
  // integration-repos call prematurely; null once loaded but no branch is set.
  const defaultBranchFromMappings = codeMappingsQuery.isSuccess
    ? (seededMappings?.[0]?.defaultBranch ?? null)
    : undefined;

  const {defaultBranch: repoDefaultBranch, isPending: isRepoInfoPending} =
    useEditRepoInfo({
      orgSlug: organization.slug,
      integrationId,
      externalId,
      defaultBranchFromMappings,
    });

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
    listKey: repositoryId,
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
      leftLabel={t('Project')}
      leftField={<LockedProjectField project={project} />}
      rightLabel={t('Repository')}
      rightField={<LockedRepoField repoName={repoName} providerKey={providerKey} />}
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
