import {Fragment, useMemo, useState} from 'react';
import {useQueries, useQuery} from '@tanstack/react-query';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import type {SelectValue} from '@sentry/scraps/select';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
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
        })),
      })),
      isReposPending: results.some(r => r.isPending),
    }),
  });

  return {
    groupedOptions,
    isPending: isIntegrationsPending || isReposPending,
  };
}

function LockedProjectField({project}: {project: Project}) {
  return (
    <Container border="primary" radius="sm" padding="xs lg">
      <Flex align="center" gap="sm">
        <ProjectAvatar project={project} size={16} />
        <Text flex={1}>{project.slug}</Text>
        <IconLock locked size="xs" />
      </Flex>
    </Container>
  );
}

function PathsPlaceholder({hasRepo}: {hasRepo: boolean}) {
  return (
    <Container border="muted" radius="md" padding="xl">
      {!hasRepo && (
        <Flex justify="center">
          <Text variant="muted">
            {t('Select a repository first to configure code paths')}
          </Text>
        </Flex>
      )}
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
  const [selectedOption, setSelectedOption] = useState<RepoSelectOption | null>(null);
  const {groupedOptions, isPending} = useGroupedRepoOptions(organization.slug);

  return (
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

          <Flex gap="md" align="end">
            <Stack gap="xs" flex={1}>
              <Text size="sm" bold>
                {t('Project')}
              </Text>
              <LockedProjectField project={project} />
            </Stack>

            <Flex paddingBottom="xs">
              <IconArrow direction="right" />
            </Flex>

            <Stack gap="xs" flex={1}>
              <Text size="sm" bold>
                {t('Repository')}
              </Text>
              <Select
                options={groupedOptions}
                value={selectedOption}
                onChange={option => setSelectedOption(option as RepoSelectOption | null)}
                placeholder={t('Search repositories')}
                isLoading={isPending}
              />
            </Stack>
          </Flex>

          <Stack gap="xs">
            <Text size="sm" bold>
              {t('Paths')}
            </Text>
            <PathsPlaceholder hasRepo={selectedOption !== null} />
          </Stack>
        </Stack>
      </Body>
      <Footer>
        <Flex justify="end" gap="md">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button priority="primary" disabled>
            {t('Save')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  );
}
