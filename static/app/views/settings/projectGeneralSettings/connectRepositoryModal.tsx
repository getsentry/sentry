import {Fragment, useMemo} from 'react';
import {useQueries, useQuery} from '@tanstack/react-query';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Select, components} from '@sentry/scraps/select';
import type {SelectValue} from '@sentry/scraps/select';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {PathMappingList} from 'sentry/components/connectRepository/pathMappingList';
import type {PathMappingValue} from 'sentry/components/connectRepository/type';
import {ScmVirtualizedMenuList} from 'sentry/components/onboarding/scm/scmVirtualizedMenuList';
import {IconLock} from 'sentry/icons';
import {IconArrow} from 'sentry/icons/iconArrow';
import {t, tct} from 'sentry/locale';
import type {Integration, IntegrationRepository} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';

const REPOS_STALE_TIME_MS = 60_000;

type RepoSelectOption = SelectValue<string> & {
  defaultBranch?: string | null;
  providerKey?: string;
};

type RepoGroup = {
  label: string;
  options: RepoSelectOption[];
};

interface Props extends ModalRenderProps {
  project: Project;
}

function scmIntegrationsOptions(orgSlug: string) {
  return apiOptions.as<Integration[]>()(
    '/organizations/$organizationIdOrSlug/integrations/',
    {
      path: {organizationIdOrSlug: orgSlug},
      query: {integrationType: 'source_code_management'},
      staleTime: REPOS_STALE_TIME_MS,
    }
  );
}

function integrationReposOptions(orgSlug: string, integrationId: string) {
  return apiOptions.as<{repos: IntegrationRepository[]}>()(
    '/organizations/$organizationIdOrSlug/integrations/$integrationId/repos/',
    {
      path: {organizationIdOrSlug: orgSlug, integrationId},
      staleTime: REPOS_STALE_TIME_MS,
    }
  );
}

function useGroupedRepoOptions(orgSlug: string): {
  flatOptions: RepoSelectOption[];
  groupedOptions: RepoGroup[];
  isPending: boolean;
} {
  const {data: integrations = [], isPending: isIntegrationsPending} = useQuery(
    scmIntegrationsOptions(orgSlug)
  );

  const activeIntegrations = useMemo(
    () =>
      integrations.filter(
        i => i.organizationIntegrationStatus === 'active' && i.status === 'active'
      ),
    [integrations]
  );

  const {groupedOptions, isReposPending} = useQueries({
    queries: activeIntegrations.map(i => integrationReposOptions(orgSlug, i.id)),
    combine: results => ({
      groupedOptions: activeIntegrations.map((integration, idx) => ({
        label: integration.name,
        options: (results[idx]?.data?.repos ?? []).map(repo => ({
          value: `${integration.id}:${repo.identifier}`,
          label: repo.name,
          leadingItems: getIntegrationIcon(integration.provider.key, 'sm'),
          defaultBranch: repo.defaultBranch,
          providerKey: integration.provider.key,
        })),
      })),
      isReposPending: results.some(r => r.isPending),
    }),
  });

  const flatOptions = groupedOptions.flatMap(g => g.options);

  return {
    groupedOptions,
    flatOptions,
    isPending: isIntegrationsPending || isReposPending,
  };
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

export function ConnectRepositoryModal({
  Header,
  Body,
  Footer,
  closeModal,
  project,
}: Props) {
  const organization = useOrganization();
  const {groupedOptions, flatOptions, isPending} = useGroupedRepoOptions(
    organization.slug
  );

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      repository: null as string | null,
      pathMappings: [] as PathMappingValue[],
    },
    onSubmit: () => {},
  });

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
                <Button variant="primary" disabled={!canSave}>
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
