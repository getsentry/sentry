import {useInfiniteQuery} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Flex} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';
import {Text} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {PanelItem} from 'sentry/components/panels/panelItem';
import {IconAdd, IconEllipsis} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ConnectRepositoryModal} from 'sentry/components/connectRepository/connectRepositoryModal';
import {
  projectRepoInfiniteOptions,
  type ProjectRepoListItem,
} from 'sentry/components/connectRepository/queries';

function ConnectedRepositoryRow({
  repo,
  project,
}: {
  project: Project;
  repo: ProjectRepoListItem;
}) {
  const {openModal} = useModal();

  const overflowItems = [
    {
      key: 'edit',
      label: t('Edit'),
      onAction: () =>
        openModal(modalProps => (
          <ConnectRepositoryModal
            {...modalProps}
            project={project}
            mode="edit"
            repositoryId={repo.repositoryId}
            repoName={repo.repoName}
            providerKey={repo.providerKey}
            integrationId={repo.integrationId}
            externalId={repo.externalId}
          />
        )),
    },
    {
      key: 'disconnect',
      label: t('Disconnect'),
      disabled: true,
      tooltip: t('TODO: Disconnect'),
    },
  ];

  return (
    <PanelItem center>
      <Flex justify="between" align="center" style={{flex: 1}}>
        <Flex align="center" gap="md">
          {getIntegrationIcon(repo.providerKey ?? undefined, 'sm')}
          <Text>{repo.repoName}</Text>
        </Flex>
        <Flex align="center" gap="md">
          <Tag variant="info">
            <Text as="span" tabular>
              {tn('%s mapping', '%s mappings', repo.mappingCount)}
            </Text>
          </Tag>
          <DropdownMenu
            items={overflowItems}
            position="bottom-end"
            trigger={triggerProps => (
              <Button
                {...triggerProps}
                size="xs"
                variant="transparent"
                aria-label={t('More Actions')}
                icon={<IconEllipsis />}
              />
            )}
          />
        </Flex>
      </Flex>
    </PanelItem>
  );
}

export function ConnectedRepositoriesPanel({project}: {project: Project}) {
  const organization = useOrganization();
  const {openModal} = useModal();

  const query = useInfiniteQuery(
    projectRepoInfiniteOptions({
      orgSlug: organization.slug,
      projectSlug: project.slug,
    })
  );
  useFetchAllPages({result: query});

  // Wait for every page so repository mapping counts are complete.
  const isLoadingAllPages =
    !query.isError && (query.isPending || query.isFetchingNextPage || query.hasNextPage);

  const repos = query.data?.pages.flatMap(p => p.json) ?? [];

  function renderBody() {
    if (isLoadingAllPages) {
      return (
        <Flex justify="center" align="center" padding="xl">
          <LoadingIndicator mini />
        </Flex>
      );
    }
    if (query.isError) {
      return <LoadingError message={t('Failed to load connected repositories.')} />;
    }
    if (repos.length === 0) {
      return (
        <Flex padding="xl">
          <Text variant="muted">{t('No repositories connected')}</Text>
        </Flex>
      );
    }
    return repos.map(repo => (
      <ConnectedRepositoryRow key={repo.id} repo={repo} project={project} />
    ));
  }

  return (
    <Panel>
      <PanelHeader hasButtons>
        <span>{t('Connected Repositories')}</span>
        <Button
          size="xs"
          icon={<IconAdd />}
          onClick={() =>
            openModal(modalProps => (
              <ConnectRepositoryModal {...modalProps} project={project} mode="connect" />
            ))
          }
        >
          {t('Connect repository')}
        </Button>
      </PanelHeader>
      <PanelBody>{renderBody()}</PanelBody>
    </Panel>
  );
}
