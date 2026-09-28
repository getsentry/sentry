import {Fragment, useState} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Select, components} from '@sentry/scraps/select';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {PathMappingList} from 'sentry/components/connectRepository/pathMappingList';
import type {PathMappingValue} from 'sentry/components/connectRepository/type';
import {ScmVirtualizedMenuList} from 'sentry/components/onboarding/scm/scmVirtualizedMenuList';
import {IconLock} from 'sentry/icons';
import {IconArrow} from 'sentry/icons/iconArrow';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  saveProjectRepoConnection,
  projectRepoInfiniteOptions,
  type RepoSelectOption,
  useGroupedRepoOptions,
} from 'sentry/views/settings/projectGeneralSettings/queries';

function getApiErrorMessage(error: unknown): string {
  if (!(error instanceof RequestError)) {
    return t('Failed to connect repository');
  }

  const json = error.responseJSON;

  // Plain-string response body (e.g. "Missing param: integrationId").
  if (typeof (json as unknown) === 'string') {
    return json as unknown as string;
  }

  const {detail} = json ?? {};
  if (typeof detail === 'string' && detail) {
    return detail;
  }
  if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
    return detail.message;
  }

  // Non-field errors (e.g. duplicate code mapping: {nonFieldErrors: [...]}).
  const nonFieldErrors = json?.nonFieldErrors ?? json?.non_field_errors;
  if (Array.isArray(nonFieldErrors) && typeof nonFieldErrors[0] === 'string') {
    return nonFieldErrors[0];
  }

  // First field-level error (e.g. {repositoryId: ["Repository does not exist"]}).
  for (const value of Object.values(json ?? {})) {
    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0];
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

interface Props extends ModalRenderProps {
  project: Project;
}

export function ConnectRepositoryModal({
  Header,
  Body,
  Footer,
  closeModal,
  project,
}: Props) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const [selectedOption, setSelectedOption] = useState<RepoSelectOption | null>(null);
  const [pathMappings, setPathMappings] = useState<PathMappingValue[]>([]);
  const {groupedOptions, isPending} = useGroupedRepoOptions(organization.slug);

  const saveMutation = useMutation({
    mutationFn: saveProjectRepoConnection,
    onSuccess: async () => {
      await queryClient.invalidateQueries(
        projectRepoInfiniteOptions({
          orgSlug: organization.slug,
          projectSlug: project.slug,
        })
      );
      closeModal();
    },
  });

  const canSave = selectedOption !== null && pathMappings.length > 0;
  const saveError = saveMutation.isError ? getApiErrorMessage(saveMutation.error) : null;

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h4">
          {tct('Connect a repository to [project]', {project: project.slug})}
        </Heading>
      </Header>
      <Body>
        <Stack gap="xl">
          {saveError && (
            <Alert.Container>
              <Alert variant="danger">{saveError}</Alert>
            </Alert.Container>
          )}
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
            </Container>
          </Grid>

          {selectedOption ? (
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
            disabled={!canSave || saveMutation.isPending}
            busy={saveMutation.isPending}
            onClick={() => {
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
          >
            {t('Save')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  );
}
