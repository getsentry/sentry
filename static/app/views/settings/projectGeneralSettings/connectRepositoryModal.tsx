import {Fragment, useMemo, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Select, components} from '@sentry/scraps/select';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {DEFAULT_BRANCH} from 'sentry/components/connectRepository/normalization';
import {PathMappingList} from 'sentry/components/connectRepository/pathMappingList';
import type {PathMappingValue} from 'sentry/components/connectRepository/type';
import {getPathMappingWarnings} from 'sentry/components/connectRepository/warnings';
import {ScmVirtualizedMenuList} from 'sentry/components/onboarding/scm/scmVirtualizedMenuList';
import {IconLock} from 'sentry/icons';
import {IconArrow} from 'sentry/icons/iconArrow';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  editProjectRepoMappings,
  projectCodeMappingsOptions,
  saveProjectRepoConnection,
  projectRepoInfiniteOptions,
  type RepoSelectOption,
  useGroupedRepoOptions,
} from 'sentry/views/settings/projectGeneralSettings/queries';

function getApiErrorMessage(error: unknown) {
  if (error instanceof RequestError) {
    const detail = error.responseJSON?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (typeof detail?.message === 'string') {
      return detail.message;
    }
  }
  return t('Failed to connect repository');
}

function LockedProjectField({project}: {project: Project}) {
  return (
    <Select
      disabled
      aria-label={t('Project')}
      options={[
        {
          value: project.slug,
          label: project.slug,
          leadingItems: <ProjectAvatar project={project} size={16} />,
        },
      ]}
      value={project.slug}
      components={{
        DropdownIndicator: props => (
          <components.DropdownIndicator {...props}>
            <IconLock locked size="xs" />
          </components.DropdownIndicator>
        ),
      }}
    />
  );
}

function LockedRepoField({
  repoName,
  providerKey,
}: {
  providerKey: string | null;
  repoName: string;
}) {
  return (
    <Select
      disabled
      aria-label={t('Repository')}
      options={[
        {
          value: repoName,
          label: repoName,
          leadingItems: getIntegrationIcon(providerKey ?? undefined, 'sm'),
        },
      ]}
      value={repoName}
      components={{
        DropdownIndicator: props => (
          <components.DropdownIndicator {...props}>
            <IconLock locked size="xs" />
          </components.DropdownIndicator>
        ),
      }}
    />
  );
}

function PathsPlaceholder() {
  return (
    <Container border="muted" radius="md" padding="2xl" style={{borderStyle: 'dashed'}}>
      <Flex justify="center">
        <Text variant="muted">
          {t('Select a repository first to configure code paths')}
        </Text>
      </Flex>
    </Container>
  );
}

type ConnectRepositoryModalProps = ModalRenderProps & {
  project: Project;
} & (
    | {mode: 'connect'}
    | {mode: 'edit'; providerKey: string | null; repoName: string; repositoryId: string}
  );

export function ConnectRepositoryModal(props: ConnectRepositoryModalProps) {
  const {Header, Body, Footer, closeModal, project} = props;
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const isEditMode = props.mode === 'edit';

  // Narrow the edit-specific fields into one alias so the rest of the
  // component body doesn't need repeated discriminant checks.
  const editRepo = props.mode === 'edit' ? props : null;

  // Connect-mode state
  const [selectedOption, setSelectedOption] = useState<RepoSelectOption | null>(null);
  const [pathMappings, setPathMappings] = useState<PathMappingValue[]>([]);
  const {groupedOptions, isPending} = useGroupedRepoOptions(organization.slug);

  // Edit-mode: fetch this project's code mappings to seed the list.
  const codeMappingsQuery = useQuery({
    ...projectCodeMappingsOptions({orgSlug: organization.slug, projectId: project.id}),
    enabled: isEditMode,
  });

  // Filter the fetched mappings to this repository. PathMappingList reads
  // `pathMappings` only on mount and the key is stable, so it will not
  // remount if the query refetches after save.
  const seededMappings = useMemo(
    () =>
      codeMappingsQuery.isSuccess
        ? (codeMappingsQuery.data ?? []).filter(m => m.repoId === editRepo?.repositoryId)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [codeMappingsQuery.isSuccess, codeMappingsQuery.data]
  );

  // integrationId for edit saves: prefer an existing mapping, fall back to
  // the grouped repo options when the repo has no mappings yet.
  const editIntegrationId =
    seededMappings?.find(m => m.integrationId)?.integrationId ??
    groupedOptions
      .flatMap(g => g.options)
      .find(o => o.repositoryId === editRepo?.repositoryId)?.integrationId;

  // 409 messages from Code Owner-protected deletes — surfaced without closing.
  const [codeOwnerWarnings, setCodeOwnerWarnings] = useState<string[]>([]);

  const invalidateQueries = () =>
    Promise.all([
      queryClient.invalidateQueries(
        projectRepoInfiniteOptions({
          orgSlug: organization.slug,
          projectSlug: project.slug,
        })
      ),
      queryClient.invalidateQueries(
        projectCodeMappingsOptions({
          orgSlug: organization.slug,
          projectId: project.id,
        })
      ),
    ]);

  const saveMutation = useMutation({
    mutationFn: saveProjectRepoConnection,
    onSuccess: async () => {
      await invalidateQueries();
      closeModal();
    },
  });

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

  const hasExactDuplicate = getPathMappingWarnings(pathMappings).some(
    w => w?.type === 'exact'
  );
  const canSave = isEditMode
    ? codeMappingsQuery.isSuccess && pathMappings.length > 0 && !hasExactDuplicate
    : selectedOption !== null && pathMappings.length > 0 && !hasExactDuplicate;

  const saveError = isEditMode
    ? editMutation.isError
      ? getApiErrorMessage(editMutation.error)
      : null
    : saveMutation.isError
      ? getApiErrorMessage(saveMutation.error)
      : null;

  const isSaving = isEditMode ? editMutation.isPending : saveMutation.isPending;

  function handleSave() {
    if (isEditMode) {
      if (!editRepo || !seededMappings) {
        return;
      }
      editMutation.mutate({
        orgSlug: organization.slug,
        project,
        repositoryId: editRepo.repositoryId,
        integrationId: editIntegrationId ?? '',
        seededMappings,
        submittedMappings: pathMappings,
      });
    } else {
      if (!selectedOption) {
        return;
      }
      saveMutation.mutate({
        orgSlug: organization.slug,
        project,
        repositoryId: selectedOption.repositoryId,
        integrationId: selectedOption.integrationId,
        pathMappings,
      });
    }
  }

  // Seed the PathMappingValue list from server rows (carries id for diff).
  const seededPathMappings: PathMappingValue[] | undefined = seededMappings?.map(m => ({
    id: m.id,
    stackRoot: m.stackRoot,
    sourceRoot: m.sourceRoot,
    branch: m.defaultBranch ?? DEFAULT_BRANCH,
  }));

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h4">
          {props.mode === 'edit'
            ? tct('Edit [repo] connection', {repo: props.repoName})
            : tct('Connect a repository to [project]', {project: project.slug})}
        </Heading>
      </Header>
      <Body>
        <Stack gap="xl">
          {saveError && (
            <Alert.Container>
              <Alert variant="danger">{saveError}</Alert>
            </Alert.Container>
          )}
          {isEditMode && codeMappingsQuery.isError && (
            <Alert.Container>
              <Alert variant="danger">{t('Failed to load path mappings.')}</Alert>
            </Alert.Container>
          )}
          {codeOwnerWarnings.map((msg, i) => (
            <Alert.Container key={i}>
              <Alert variant="warning">{msg}</Alert>
            </Alert.Container>
          ))}
          {!isEditMode && (
            <Text as="p">
              {tct(
                'Link a repo to [project] so an error can take you straight to the line of code that caused it.',
                {
                  project: (
                    <Text as="span" bold>
                      {project.slug}
                    </Text>
                  ),
                }
              )}
            </Text>
          )}

          <Grid columns="1fr auto 1fr" gap="xs md" align="center">
            <Text size="sm" bold>
              {t('Project')}
            </Text>
            <Container />
            <Text size="sm" bold>
              {t('Repository')}
            </Text>
            <Container minWidth={0}>
              <LockedProjectField project={project} />
            </Container>
            <IconArrow direction="right" />
            <Container minWidth={0}>
              {props.mode === 'edit' ? (
                <LockedRepoField
                  repoName={props.repoName}
                  providerKey={props.providerKey}
                />
              ) : (
                <Select
                  aria-label={t('Repository')}
                  options={groupedOptions}
                  value={selectedOption?.value ?? null}
                  onChange={option => {
                    setSelectedOption(option as RepoSelectOption | null);
                    setPathMappings([]);
                    saveMutation.reset();
                  }}
                  placeholder={t('Search repositories')}
                  isLoading={isPending}
                  searchable
                  components={{MenuList: ScmVirtualizedMenuList}}
                />
              )}
            </Container>
          </Grid>

          {props.mode === 'edit' ? (
            seededPathMappings ? (
              <Container paddingTop="2xl">
                <PathMappingList
                  key={props.repositoryId}
                  providerKey={props.providerKey ?? undefined}
                  pathMappings={seededPathMappings}
                  onChange={setPathMappings}
                />
              </Container>
            ) : null
          ) : selectedOption ? (
            <Container paddingTop="2xl">
              <PathMappingList
                key={selectedOption.value}
                providerKey={selectedOption.providerKey}
                defaultBranch={selectedOption.defaultBranch ?? undefined}
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
          )}
        </Stack>
      </Body>
      <Footer>
        <Flex justify="end" gap="md">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            variant="primary"
            disabled={!canSave || isSaving}
            busy={isSaving}
            onClick={handleSave}
          >
            {t('Save')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  );
}
