import {useState} from 'react';
import {useMutation} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Container, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {PathMappingList} from 'sentry/components/connectRepository/pathMappingList';
import type {PathMappingValue} from 'sentry/components/connectRepository/type';
import {hasExactDuplicate} from 'sentry/components/connectRepository/warnings';
import {ScmVirtualizedMenuList} from 'sentry/components/onboarding/scm/scmVirtualizedMenuList';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getApiErrorMessage,
  ConnectionModalFrame,
} from 'sentry/views/settings/projectGeneralSettings/connectionModalFrame';
import {
  saveProjectRepoConnection,
  useGroupedRepoOptions,
  useInvalidateRepoQueries,
  type RepoSelectOption,
} from 'sentry/views/settings/projectGeneralSettings/queries';

function PathsPlaceholder() {
  return (
    <Container border="muted" radius="md" padding="2xl" style={{borderStyle: 'dashed'}}>
      <Text variant="muted">
        {t('Select a repository first to configure code paths')}
      </Text>
    </Container>
  );
}

export type ConnectFormProps = ModalRenderProps & {project: Project};

export function ConnectRepositoryForm({
  Header,
  Body,
  Footer,
  closeModal,
  project,
}: ConnectFormProps) {
  const organization = useOrganization();
  const [selectedOption, setSelectedOption] = useState<RepoSelectOption | null>(null);
  const [pathMappings, setPathMappings] = useState<PathMappingValue[]>([]);
  const {groupedOptions, isPending} = useGroupedRepoOptions(organization.slug);
  const invalidateQueries = useInvalidateRepoQueries(
    organization.slug,
    project.slug,
    project.id
  );

  const saveMutation = useMutation({
    mutationFn: saveProjectRepoConnection,
    onSuccess: async () => {
      await invalidateQueries();
      closeModal();
    },
  });

  const canSave =
    selectedOption !== null &&
    pathMappings.length > 0 &&
    !hasExactDuplicate(pathMappings);

  const intro = (
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
  );

  const saveAlert = saveMutation.isError ? (
    <Alert.Container>
      <Alert variant="danger">{getApiErrorMessage(saveMutation.error)}</Alert>
    </Alert.Container>
  ) : null;

  const repoField = (
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
  );

  const pathsSection = selectedOption ? (
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
  );

  return (
    <ConnectionModalFrame
      Header={Header}
      Body={Body}
      Footer={Footer}
      closeModal={closeModal}
      title={tct('Connect a repository to [project]', {project: project.slug})}
      intro={intro}
      alerts={saveAlert}
      project={project}
      repoField={repoField}
      pathsSection={pathsSection}
      canSave={canSave}
      isSaving={saveMutation.isPending}
      onSave={() => {
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
      }}
    />
  );
}
