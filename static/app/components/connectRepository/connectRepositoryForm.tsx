import {useState} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {
  ConnectionModalFrame,
  LockedProjectField,
  getApiErrorMessage,
} from 'sentry/components/connectRepository/connectionModalFrame';
import {PathMappingList} from 'sentry/components/connectRepository/pathMappingList';
import {
  projectCodeMappingsOptions,
  saveProjectRepoConnection,
  useGroupedRepoOptions,
  useInvalidateRepoQueries,
  type RepoSelectOption,
} from 'sentry/components/connectRepository/queries';
import type {PathMappingValue} from 'sentry/components/connectRepository/type';
import {hasExactDuplicate} from 'sentry/components/connectRepository/warnings';
import {ScmVirtualizedMenuList} from 'sentry/components/onboarding/scm/scmVirtualizedMenuList';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';

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
  const {groupedOptions, isPending: isReposPending} = useGroupedRepoOptions(
    organization.slug
  );
  const invalidateQueries = useInvalidateRepoQueries(organization.slug);

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      repository: null as string | null,
      pathMappings: [] as PathMappingValue[],
    },
    onSubmit: () => {},
  });

  const {
    data: codeMappings = [],
    isPending: codeMappingsPending,
    isError: codeMappingsError,
  } = useQuery(
    projectCodeMappingsOptions({orgSlug: organization.slug, projectId: project.id})
  );

  const saveMutation = useMutation({
    mutationFn: saveProjectRepoConnection,
    onSuccess: async () => {
      await invalidateQueries(project);
      closeModal();
    },
  });

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

  const existingMappings = codeMappings.filter(
    m => !selectedOption || m.repoId !== selectedOption.repositoryId
  );

  const pathsSection = selectedOption ? (
    <Container paddingTop="2xl">
      <PathMappingList
        key={selectedOption.value}
        form={form}
        providerKey={selectedOption.providerKey}
        defaultBranch={selectedOption.defaultBranch ?? undefined}
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

  const repoField = (
    <Select
      aria-label={t('Repository')}
      options={groupedOptions}
      value={selectedOption?.value ?? null}
      onChange={option => {
        const repo = option as RepoSelectOption | null;
        setSelectedOption(repo);
        form.setFieldValue('pathMappings', [
          {stackRoot: '', sourceRoot: '', branch: repo?.defaultBranch ?? ''},
        ]);
        saveMutation.reset();
      }}
      placeholder={t('Search repositories')}
      isLoading={isReposPending}
      searchable
      components={{MenuList: ScmVirtualizedMenuList}}
    />
  );

  return (
    <form.AppForm form={form}>
      <form.Subscribe selector={state => state.values.pathMappings}>
        {pathMappings => {
          const canSave =
            selectedOption !== null &&
            pathMappings.length > 0 &&
            !codeMappingsPending &&
            !codeMappingsError &&
            !hasExactDuplicate(pathMappings, existingMappings);

          const alerts = (
            <Stack gap="xs">
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

          return (
            <ConnectionModalFrame
              Header={Header}
              Body={Body}
              Footer={Footer}
              closeModal={closeModal}
              title={tct('Connect a repository to [project]', {project: project.slug})}
              intro={intro}
              alerts={alerts}
              leftLabel={t('Project')}
              leftField={<LockedProjectField project={project} />}
              rightLabel={t('Repository')}
              rightField={repoField}
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
        }}
      </form.Subscribe>
    </form.AppForm>
  );
}
