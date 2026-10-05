import {Fragment} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
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
  projectRepoInfiniteOptions,
  saveProjectRepoConnection,
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
  const {groupedOptions, isPending} = useGroupedRepoOptions(organization.slug);
  const flatOptions = groupedOptions.flatMap(g => g.options);

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      repository: null as string | null,
      pathMappings: [] as PathMappingValue[],
    },
    onSubmit: () => {},
  });

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

  const saveError = saveMutation.isError ? getApiErrorMessage(saveMutation.error) : null;

  return (
    <form.AppForm form={form}>
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
                <form.AppField name="repository">
                  {field => (
                    <field.Select
                      aria-label={t('Repository')}
                      clearable
                      options={groupedOptions as any}
                      value={field.state.value}
                      disabled={saveMutation.isPending}
                      onChange={repoValue => {
                        field.handleChange(repoValue as string | null);
                        const selected = flatOptions.find(o => o.value === repoValue);
                        form.setFieldValue('pathMappings', [
                          {
                            stackRoot: '',
                            sourceRoot: '',
                            branch: selected?.defaultBranch ?? '',
                          },
                        ]);
                        saveMutation.reset();
                      }}
                      placeholder={t('Search repositories')}
                      isLoading={isPending}
                      isSearchable
                      components={{MenuList: ScmVirtualizedMenuList}}
                    />
                  )}
                </form.AppField>
              </Container>
            </Grid>

            <form.Subscribe selector={state => state.values.repository}>
              {repository =>
                repository ? (
                  <Container paddingTop="2xl">
                    <PathMappingList
                      key={repository}
                      form={form}
                      providerKey={
                        flatOptions.find(o => o.value === repository)?.providerKey
                      }
                      defaultBranch={
                        flatOptions.find(o => o.value === repository)?.defaultBranch ??
                        undefined
                      }
                    />
                  </Container>
                ) : (
                  <Stack gap="xs" paddingTop="2xl">
                    <Text size="sm" bold>
                      {t('Paths')}
                    </Text>
                    <PathsPlaceholder />
                  </Stack>
                )
              }
            </form.Subscribe>
          </Stack>
        </Body>
        <Footer>
          <Flex justify="end" gap="md">
            <Button onClick={closeModal}>{t('Cancel')}</Button>
            <form.Subscribe selector={state => state.values.repository !== null}>
              {canSave => (
                <Button
                  variant="primary"
                  disabled={!canSave || saveMutation.isPending}
                  busy={saveMutation.isPending}
                  onClick={() => {
                    const {repository, pathMappings} = form.state.values;
                    if (!repository) {
                      return;
                    }
                    const selected = flatOptions.find(o => o.value === repository);
                    if (!selected) {
                      return;
                    }
                    saveMutation.mutate({
                      orgSlug: organization.slug,
                      project,
                      repositoryId: selected.repositoryId,
                      integrationId: selected.integrationId,
                      pathMappings,
                    });
                  }}
                >
                  {t('Save')}
                </Button>
              )}
            </form.Subscribe>
          </Flex>
        </Footer>
      </Fragment>
    </form.AppForm>
  );
}
