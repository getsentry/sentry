import {useMemo} from 'react';
import {useInfiniteQuery} from '@tanstack/react-query';
import groupBy from 'lodash/groupBy';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {PanelItem} from 'sentry/components/panels/panelItem';
import {IconAdd, IconEllipsis} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {RepositoryProjectPathConfig} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';

type ConnectedRepo = {
  mappingCount: number;
  provider: RepositoryProjectPathConfig['provider'];
  repoId: string;
  repoName: string;
};

const OVERFLOW_ITEMS: MenuItemProps[] = [
  {key: 'edit', label: t('Edit'), disabled: true, tooltip: t('Coming soon')},
  {key: 'disconnect', label: t('Disconnect'), disabled: true, tooltip: t('Coming soon')},
];

function projectCodeMappingsInfiniteOptions({
  orgSlug,
  projectId,
}: {
  orgSlug: string;
  projectId: string;
}) {
  return apiOptions.asInfinite<RepositoryProjectPathConfig[]>()(
    '/organizations/$organizationIdOrSlug/code-mappings/',
    {
      path: {organizationIdOrSlug: orgSlug},
      query: {project: projectId, per_page: 100},
      staleTime: 10_000,
    }
  );
}

function groupMappingsByRepo(mappings: RepositoryProjectPathConfig[]): ConnectedRepo[] {
  return Object.values(groupBy(mappings, m => m.repoId)).map(group => ({
    repoId: group[0]!.repoId,
    repoName: group[0]!.repoName,
    provider: group[0]!.provider,
    mappingCount: group.length,
  }));
}

function ConnectedRepositoryRow({repo}: {repo: ConnectedRepo}) {
  return (
    <PanelItem center>
      <Flex justify="between" align="center" style={{flex: 1}}>
        <Flex align="center" gap="md">
          {getIntegrationIcon(repo.provider?.key, 'sm')}
          <Text>{repo.repoName}</Text>
        </Flex>
        <Flex align="center" gap="md">
          <Tag variant="info">
            <Text as="span" tabular>
              {tn('%s mapping', '%s mappings', repo.mappingCount)}
            </Text>
          </Tag>
          <DropdownMenu
            items={OVERFLOW_ITEMS}
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

  const query = useInfiniteQuery(
    projectCodeMappingsInfiniteOptions({
      orgSlug: organization.slug,
      projectId: project.id,
    })
  );
  useFetchAllPages({result: query});

  const connectedRepos = useMemo(() => {
    const mappings = query.data?.pages.flatMap(p => p.json) ?? [];
    return groupMappingsByRepo(mappings);
  }, [query.data]);

  function renderBody() {
    if (query.isPending) {
      return (
        <Flex justify="center" align="center" padding="xl">
          <LoadingIndicator />
        </Flex>
      );
    }
    if (query.isError) {
      return <LoadingError />;
    }
    if (connectedRepos.length === 0) {
      return (
        <Flex padding="xl">
          <Text variant="muted">{t('No repositories connected')}</Text>
        </Flex>
      );
    }
    return connectedRepos.map(repo => (
      <ConnectedRepositoryRow key={repo.repoId} repo={repo} />
    ));
  }

  return (
    <Panel>
      <PanelHeader hasButtons>
        <span>{t('Connected Repositories')}</span>
        <Button size="xs" icon={<IconAdd />}>
          {t('Connect repository')}
        </Button>
      </PanelHeader>
      <PanelBody>{renderBody()}</PanelBody>
    </Panel>
  );
}
