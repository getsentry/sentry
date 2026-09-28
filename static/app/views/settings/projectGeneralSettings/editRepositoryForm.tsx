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
  useGroupedRepoOptions,
  useInvalidateRepoQueries,
} from 'sentry/views/settings/projectGeneralSettings/queries';

function buildPathsSection({
  isPending,
  seededPathMappings,
  repositoryId,
  providerKey,
  onChange,
}: {
  isPending: boolean;
  onChange: (mappings: PathMappingValue[]) => void;
  providerKey: string | null;
  repositoryId: string;
  seededPathMappings: PathMappingValue[] | undefined;
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
        key={repositoryId}
        providerKey={providerKey ?? undefined}
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
  const {groupedOptions} = useGroupedRepoOptions(organization.slug);
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

  // Prefer an integration id from an existing mapping; fall back to the repo
  // select options for repositories that have no mappings yet.
  const editIntegrationId =
    seededMappings?.find(m => m.integrationId)?.integrationId ??
    groupedOptions.flatMap(g => g.options).find(o => o.repositoryId === repositoryId)
      ?.integrationId;

  const editMutation = useMutation({
    mutationFn: editProjectRepoMappings,
    onSuccess: async ({codeOwnerMessages}) => {
      await invalidateQueries();
      if (codeOwnerMessages.length === 0) {
        closeModal();
      } else {
        setCodeOwnerWarnings(codeOwnerMessages);
      }
    },
  });

  const canSave =
    codeMappingsQuery.isSuccess &&
    pathMappings.length > 0 &&
    !hasExactDuplicate(pathMappings);

  const seededPathMappings = seededMappings?.map(m => ({
    id: m.id,
    stackRoot: m.stackRoot,
    sourceRoot: m.sourceRoot,
    branch: m.defaultBranch ?? DEFAULT_BRANCH,
  }));

  const pathsSection = buildPathsSection({
    isPending: codeMappingsQuery.isPending,
    seededPathMappings,
    repositoryId,
    providerKey,
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
        if (!seededMappings) {
          return;
        }
        editMutation.mutate({
          orgSlug: organization.slug,
          project,
          repositoryId,
          integrationId: editIntegrationId ?? '',
          seededMappings,
          submittedMappings: pathMappings,
        });
      }}
    />
  );
}
