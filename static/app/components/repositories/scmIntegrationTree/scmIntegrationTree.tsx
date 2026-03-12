import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useVirtualizer} from '@tanstack/react-virtual';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {addRepository, hideRepository} from 'sentry/actionCreators/integrations';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {buildIntegrationTreeNodes} from 'sentry/components/repositories/scmIntegrationTree/scmIntegrationTreeNodes';
import {ScmIntegrationTreeRow} from 'sentry/components/repositories/scmIntegrationTree/scmIntegrationTreeRow';
import type {
  ProviderFilter,
  RepoFilter,
  TreeNode,
} from 'sentry/components/repositories/scmIntegrationTree/types';
import {useScmIntegrationTreeData} from 'sentry/components/repositories/scmIntegrationTree/useScmIntegrationTreeData';
import {t} from 'sentry/locale';
import type {
  Integration,
  IntegrationRepository,
  Repository,
} from 'sentry/types/integrations';
import type {InfiniteData} from 'sentry/utils/queryClient';
import {useQueryClient} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

const ROW_HEIGHT = 56;
const BOTTOM_PADDING = 24;

type Props = {
  providerFilter: ProviderFilter;
  repoFilter: RepoFilter;
  search: string;
};

export function ScmIntegrationTree({search, repoFilter, providerFilter}: Props) {
  const api = useApi();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  const {
    scmProviders,
    scmIntegrations,
    connectedIdentifiers,
    refetchIntegrations,
    reposByIntegrationId,
    reposPendingByIntegrationId,
    reposQueryKey,
    isPending,
    isError,
  } = useScmIntegrationTreeData();

  // Expansion state
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [expandedIntegrations, setExpandedIntegrations] = useState<Set<string>>(
    new Set()
  );

  // Expand all providers once data first loads
  const providersInitialized = useRef(false);
  useEffect(() => {
    if (!providersInitialized.current && scmProviders.length > 0) {
      providersInitialized.current = true;
      setExpandedProviders(new Set(scmProviders.map(p => p.key)));
    }
  }, [scmProviders]);

  // In-flight toggle state to disable checkboxes during mutation
  const [togglingRepos, setTogglingRepos] = useState<Set<string>>(new Set());

  const toggleProvider = useCallback((providerKey: string) => {
    setExpandedProviders(prev => {
      const next = new Set(prev);
      if (next.has(providerKey)) {
        next.delete(providerKey);
      } else {
        next.add(providerKey);
      }
      return next;
    });
  }, []);

  const toggleIntegration = useCallback((integrationId: string) => {
    setExpandedIntegrations(prev => {
      const next = new Set(prev);
      if (next.has(integrationId)) {
        next.delete(integrationId);
      } else {
        next.add(integrationId);
      }
      return next;
    });
  }, []);

  // Flatten the tree into a list based on current expansion state
  const flatNodes = useMemo<TreeNode[]>(
    () =>
      buildIntegrationTreeNodes({
        scmProviders,
        scmIntegrations,
        reposByIntegrationId,
        reposPendingByIntegrationId,
        connectedIdentifiers,
        expandedProviders,
        expandedIntegrations,
        togglingRepos,
        search,
        repoFilter,
        providerFilter,
      }),
    [
      scmProviders,
      scmIntegrations,
      reposByIntegrationId,
      reposPendingByIntegrationId,
      connectedIdentifiers,
      expandedProviders,
      expandedIntegrations,
      togglingRepos,
      search,
      repoFilter,
      providerFilter,
    ]
  );

  const virtualizer = useVirtualizer({
    count: flatNodes.length,
    getScrollElement: () => scrollBodyRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: i => {
      const node = flatNodes[i]!;
      if (node.type === 'provider') return `provider:${node.provider.key}`;
      if (node.type === 'integration') return `integration:${node.integration.id}`;
      if (node.type === 'add-config') return `add-config:${node.provider.key}`;
      if (node.type === 'no-match') return `no-match:${node.integrationId}`;
      return `repo:${node.repo.identifier}`;
    },
  });

  const handleAddIntegration = useCallback(() => {
    refetchIntegrations();
  }, [refetchIntegrations]);

  const handleToggleRepo = useCallback(
    async (
      repo: IntegrationRepository,
      integration: Integration,
      isConnected: boolean
    ) => {
      setTogglingRepos(prev => new Set(prev).add(repo.identifier));

      try {
        if (isConnected) {
          // Find the connected Repository to get its id for the API call
          const connectedRepo = queryClient
            .getQueryData<InfiniteData<{json: Repository[]}>>(reposQueryKey as any)
            ?.pages.flatMap(p => p.json)
            .find(r => r.name === repo.identifier);

          if (!connectedRepo) {
            return;
          }

          const updated = await hideRepository(api, organization.slug, connectedRepo.id);
          queryClient.setQueryData(
            reposQueryKey as any,
            (old: InfiniteData<{json: Repository[]}> | undefined) => {
              if (!old) return old;
              return {
                ...old,
                pages: old.pages.map(page => ({
                  ...page,
                  json: page.json.map(r => (r.id === updated.id ? updated : r)),
                })),
              };
            }
          );
          addSuccessMessage(t('Removed %s', repo.name));
        } else {
          const newRepo = await addRepository(
            api,
            organization.slug,
            repo.identifier,
            integration
          );
          queryClient.setQueryData(
            reposQueryKey as any,
            (old: InfiniteData<{json: Repository[]}> | undefined) => {
              if (!old) return old;
              return {
                ...old,
                pages: [
                  {...old.pages[0]!, json: [newRepo, ...(old.pages[0]?.json ?? [])]},
                  ...old.pages.slice(1),
                ],
              };
            }
          );
          addSuccessMessage(t('Added %s', repo.name));
        }
      } finally {
        setTogglingRepos(prev => {
          const next = new Set(prev);
          next.delete(repo.identifier);
          return next;
        });
      }
    },
    [api, organization.slug, queryClient, reposQueryKey]
  );

  // Dynamic height: fill remaining viewport
  const [scrollBodyHeight, setScrollBodyHeight] = useState<number | undefined>(undefined);
  const setScrollBodyRef = useCallback((el: HTMLDivElement | null) => {
    scrollBodyRef.current = el;
    if (el) {
      requestAnimationFrame(() => {
        const top = el.getBoundingClientRect().top;
        setScrollBodyHeight(Math.round(top + BOTTOM_PADDING));
      });
    }
  }, []);

  if (isPending) {
    return (
      <Flex justify="center" align="center" padding="xl" style={{minHeight: 200}}>
        <LoadingIndicator />
      </Flex>
    );
  }

  if (isError) {
    return (
      <Flex justify="center" align="center" padding="xl" style={{minHeight: 200}}>
        <LoadingError />
      </Flex>
    );
  }

  if (scmProviders.length === 0) {
    return (
      <Flex direction="column" align="center" gap="md" padding="xl" minHeight={200}>
        <Text size="md" variant="muted">
          {t('No source code management integrations found.')}
        </Text>
        <LinkButton
          priority="primary"
          to={`/settings/${organization.slug}/integrations/?category=source+code+management`}
        >
          {t('Connect an Integration')}
        </LinkButton>
      </Flex>
    );
  }

  return (
    <TreePanel>
      <ScrollableBody
        ref={setScrollBodyRef}
        style={{
          maxHeight: scrollBodyHeight ? `calc(100vh - ${scrollBodyHeight}px)` : undefined,
        }}
      >
        <VirtualInner style={{height: virtualizer.getTotalSize()}}>
          {virtualizer.getVirtualItems().map(virtualItem => {
            const node = flatNodes[virtualItem.index];
            if (!node) return null;

            return (
              <ScmIntegrationTreeRow
                key={virtualItem.key}
                node={node}
                style={{
                  transform: `translateY(${virtualItem.start}px)`,
                  height: virtualItem.size,
                }}
                onAddIntegration={handleAddIntegration}
                onToggleProvider={toggleProvider}
                onToggleIntegration={toggleIntegration}
                onToggleRepo={handleToggleRepo}
              />
            );
          })}
        </VirtualInner>
      </ScrollableBody>
    </TreePanel>
  );
}

const TreePanel = styled(Panel)`
  margin: 0;
  width: 100%;
  overflow: hidden;
`;

const ScrollableBody = styled('div')`
  position: relative;
  overflow-y: auto;
  min-height: 0;
`;

const VirtualInner = styled('div')`
  position: relative;
  width: 100%;
`;
