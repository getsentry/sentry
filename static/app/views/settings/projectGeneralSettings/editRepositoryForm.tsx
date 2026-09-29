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
  LockedRepoField,
} from 'sentry/views/settings/projectGeneralSettings/connectionModalFrame';
import {
  editProjectRepoMappings,
  projectCodeMappingsOptions,
  useEditRepoInfo,
  useInvalidateRepoQueries,
} from 'sentry/views/settings/projectGeneralSettings/queries';

function buildPathsSection({
  isPending,
  seededPathMappings,
  listKey,
  providerKey,
  defaultBranch,
  onChange,
}: {
  isPending: boolean;
  listKey: string;
  onChange: (mappings: PathMappingValue[]) => void;
  providerKey: string | null;
  seededPathMappings: PathMappingValue[] | undefined;
  defaultBranch?: string;
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
        pathMappings={seededPathMappings}
        onChange={onChange}
      />
    </Container>
  );
}

export type EditFormProps = ModalRenderProps & {
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
}: EditFormProps) {
  const organization = useOrganization();
  const [pathMappings, setPathMappings] = useState<PathMappingValue[]>([]);
  const [codeOwnerWarnings, setCodeOwnerWarnings] = useState<string[]>([]);
  const [listEpoch, setListEpoch] = useState(0);
  const invalidateQueries = useInvalidateRepoQueries(
    organization.slug,
    project.slug,
    project.id
  );

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

  // Derive from existing mappings so useEditRepoInfo can skip network calls.
  const integrationIdFromMappings = seededMappings?.find(
    m => m.integrationId
  )?.integrationId;
  const defaultBranchFromMappings = seededMappings?.[0]?.defaultBranch ?? null;

  const {
    integrationId: editIntegrationId,
    defaultBranch: repoDefaultBranch,
    isPending: isRepoInfoPending,
  } = useEditRepoInfo({
    orgSlug: organization.slug,
    repositoryId,
    integrationIdFromMappings,
    defaultBranchFromMappings,
  });

  const editMutation = useMutation({
    mutationFn: editProjectRepoMappings,
    onSuccess: async ({codeOwnerMessages}) => {
      await invalidateQueries();
      if (codeOwnerMessages.length === 0) {
        closeModal();
      } else {
        // Remount so local rows pick up server IDs; otherwise a retry DELETEs
        // mappings that were just POSTed.
        setListEpoch(n => n + 1);
        setCodeOwnerWarnings(codeOwnerMessages);
      }
    },
  });

  const canSave =
    codeMappingsQuery.isSuccess &&
    Boolean(editIntegrationId) &&
    pathMappings.length > 0 &&
    !hasExactDuplicate(pathMappings);

  const seededPathMappings = seededMappings?.map(m => ({
    id: m.id,
    stackRoot: m.stackRoot,
    sourceRoot: m.sourceRoot,
    branch: m.defaultBranch ?? DEFAULT_BRANCH,
  }));

  const pathsSection = buildPathsSection({
    isPending: codeMappingsQuery.isPending || isRepoInfoPending,
    seededPathMappings,
    listKey: `${repositoryId}-${listEpoch}`,
    providerKey,
    defaultBranch: repoDefaultBranch ?? undefined,
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
      {codeOwnerWarnings.map((msg, i) => (
        <Alert.Container key={i}>
          <Alert variant="warning">{msg}</Alert>
        </Alert.Container>
      ))}
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
      project={project}
      repoField={<LockedRepoField repoName={repoName} providerKey={providerKey} />}
      pathsSection={pathsSection}
      canSave={canSave}
      isSaving={editMutation.isPending}
      onSave={() => {
        if (!seededMappings || !editIntegrationId) {
          return;
        }
        editMutation.mutate({
          orgSlug: organization.slug,
          project,
          repositoryId,
          integrationId: editIntegrationId,
          seededMappings,
          submittedMappings: pathMappings,
        });
      }}
    />
  );
}
