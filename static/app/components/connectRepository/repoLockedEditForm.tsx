import {Fragment, useEffect, useMemo, useState} from 'react';
import {useInfiniteQuery, useMutation, useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Container, Flex} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {DEFAULT_BRANCH} from 'sentry/components/connectRepository/normalization';
import {PathMappingList} from 'sentry/components/connectRepository/pathMappingList';
import type {PathMappingValue} from 'sentry/components/connectRepository/type';
import {hasExactDuplicate} from 'sentry/components/connectRepository/warnings';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  ConnectionModalFrame,
  LockedRepoField,
  getApiErrorMessage,
} from 'sentry/components/connectRepository/connectionModalFrame';
import {
  editProjectRepoMappings,
  orgCodeMappingsInfiniteOptions,
  projectCodeMappingsOptions,
  useEditRepoInfo,
  useInvalidateRepoQueries,
} from 'sentry/components/connectRepository/queries';

export type RepoLockedEditFormProps = ModalRenderProps & {
  externalId: string | null;
  integrationId: string | null;
  providerKey: string | null;
  repoName: string;
  repositoryId: string;
};

type MappedProject = {id: string; slug: string};

/** Derives the set of projects already connected to this repo from the cached
 *  org code-mappings query. Fast path: data is already in cache from the
 *  Repositories page. Slow path: fetches all pages if needed. */
function useMappedProjectsForRepo(
  orgSlug: string,
  repositoryId: string
): {mappedProjects: MappedProject[]; isPending: boolean} {
  const codeMappingsQuery = useInfiniteQuery(orgCodeMappingsInfiniteOptions(orgSlug));
  useFetchAllPages({result: codeMappingsQuery});

  const mappedProjects = useMemo(() => {
    const allMappings = codeMappingsQuery.data?.pages.flatMap(p => p.json) ?? [];
    const seen = new Set<string>();
    return allMappings
      .filter(m => m.repoId === repositoryId)
      .filter(m => {
        if (seen.has(m.projectId)) {
          return false;
        }
        seen.add(m.projectId);
        return true;
      })
      .map(m => ({id: m.projectId, slug: m.projectSlug}));
  }, [codeMappingsQuery.data, repositoryId]);

  const isPending =
    !codeMappingsQuery.isError &&
    (codeMappingsQuery.isPending ||
      codeMappingsQuery.isFetchingNextPage ||
      Boolean(codeMappingsQuery.hasNextPage));

  return {mappedProjects, isPending};
}

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
}: RepoLockedEditFormProps) {
  const organization = useOrganization();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [pathMappings, setPathMappings] = useState<PathMappingValue[]>([]);
  const invalidateQueries = useInvalidateRepoQueries(organization.slug);

  const {mappedProjects, isPending: isMappedProjectsPending} = useMappedProjectsForRepo(
    organization.slug,
    repositoryId
  );

  // Auto-select when there is exactly one mapped project.
  useEffect(() => {
    if (mappedProjects.length === 1 && selectedProjectId === null) {
      setSelectedProjectId(mappedProjects[0]!.id);
    }
  }, [mappedProjects, selectedProjectId]);

  const selectedProject = mappedProjects.find(p => p.id === selectedProjectId) ?? null;

  const codeMappingsQuery = useQuery({
    ...projectCodeMappingsOptions({
      orgSlug: organization.slug,
      projectId: selectedProjectId ?? '',
    }),
    enabled: selectedProjectId !== null,
  });

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
      await invalidateQueries(selectedProject ?? undefined);
      closeModal();
    },
  });

  const canSave =
    selectedProject !== null &&
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

  const projectOptions = mappedProjects.map(p => ({value: p.id, label: p.slug}));

  const projectField = (
    <Select
      aria-label={t('Project')}
      options={projectOptions}
      value={selectedProjectId}
      onChange={option => {
        setSelectedProjectId((option as {value: string} | null)?.value ?? null);
        setPathMappings([]);
        editMutation.reset();
      }}
      placeholder={t('Select a project')}
      isLoading={isMappedProjectsPending}
    />
  );

  const pathsSection = buildPathsSection({
    isPending:
      isMappedProjectsPending ||
      codeMappingsQuery.isPending ||
      isRepoInfoPending,
    seededPathMappings,
    listKey: `${repositoryId}:${selectedProjectId}`,
    providerKey,
    defaultBranch: repoDefaultBranch ?? undefined,
    projectSlug: selectedProject?.slug,
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
      rightField={projectField}
      pathsSection={pathsSection}
      canSave={canSave}
      isSaving={editMutation.isPending}
      onSave={() => {
        if (!selectedProject || !seededMappings || !integrationId) {
          return;
        }
        editMutation.mutate({
          orgSlug: organization.slug,
          project: selectedProject,
          repositoryId,
          integrationId,
          seededMappings,
          submittedMappings: pathMappings,
        });
      }}
    />
  );
}
