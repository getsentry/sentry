import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useVirtualizer} from '@tanstack/react-virtual';
import sortBy from 'lodash/sortBy';

import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {Placeholder} from 'sentry/components/placeholder';
import {ProjectList} from 'sentry/components/projectList';
import {TimeSince} from 'sentry/components/timeSince';
import {
  IconChevron,
  IconDelete,
  IconEllipsis,
  IconInfo,
  IconOpen,
  IconSliders,
} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import type {IntegrationProvider} from 'sentry/types/integrations';
import {highlightFuseMatches} from 'sentry/utils/highlightFuseMatches';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {useMedia} from 'sentry/utils/useMedia';
import type {
  ScmInstallation,
  ScmRepoMatches,
} from 'sentry/views/settings/organizationRepositories/types';

export interface InstallationWrapperProps {
  children: React.ReactNode;
  installation: ScmInstallation;
}

const REPO_LIST_MAX_HEIGHT = 410;
const ESTIMATED_REPO_ROW_HEIGHT = 36;

interface ScmRepositoryTableProps {
  /**
   * Installations to render, one expand/collapse section per entry.
   */
  installations: ScmInstallation[];
  /**
   * The SCM provider these installations belong to. Drives the header icon and name.
   */
  provider: IntegrationProvider;
  /**
   * Optional wrapper component rendered around each installation. Useful for
   * setting up per-installation state — e.g. wiring a sync hook that feeds
   * `isSyncing` and `onSync` back into the installation via
   * `InstallationOverrideProvider`.
   */
  installationWrapper?: React.ComponentType<InstallationWrapperProps>;
  /**
   * Fuse match results used to filter and highlight repo names.
   */
  repoMatches?: ScmRepoMatches;
}

export function ScmRepositoryTable({
  installations,
  provider,
  installationWrapper: Wrapper,
  repoMatches,
}: ScmRepositoryTableProps) {
  const {expandedIds, toggle} = useExpandedInstallations(installations);

  return (
    <Flex direction="column" gap="xl">
      {installations.map(installation => {
        const hasSearchHits =
          repoMatches !== undefined &&
          installation.repositories.some(r => repoMatches[r.id]);
        const panel = (
          <InstallationPanel
            installation={installation}
            provider={provider}
            expanded={hasSearchHits || expandedIds.has(installation.integration.id)}
            onToggle={() => toggle(installation.integration.id)}
            repoMatches={repoMatches}
          />
        );
        return Wrapper ? (
          <Wrapper key={installation.integration.id} installation={installation}>
            {panel}
          </Wrapper>
        ) : (
          <Fragment key={installation.integration.id}>{panel}</Fragment>
        );
      })}
    </Flex>
  );
}

interface OverrideProviderProps {
  children: React.ReactNode;
  value: Partial<ScmInstallation>;
}

/**
 * Provides overrides that are merged into the nearest installation before
 * rendering. Use inside an `installationWrapper` component to inject
 * per-installation state (e.g. `isSyncing`, `onSync`) without prop-drilling.
 */
export function InstallationOverrideProvider({value, children}: OverrideProviderProps) {
  return (
    <ScmInstallationContext.Provider value={value}>
      {children}
    </ScmInstallationContext.Provider>
  );
}

/**
 * Tracks which installations are expanded via an explicit user-toggle override
 * map. The effective expansion state is `overrides.get(id) ?? initiallyExpanded`.
 * Late-arriving installations get their default applied automatically.
 */
function useExpandedInstallations(installations: ScmInstallation[]) {
  const [overrides, setOverrides] = useState<Map<string, boolean>>(() => new Map());

  const defaultExpandedById = useMemo(() => {
    const fallback = installations.length === 1;
    return new Map(
      installations.map(i => [i.integration.id, i.initiallyExpanded ?? fallback])
    );
  }, [installations]);

  const expandedIds = useMemo(() => {
    const expanded = installations
      .map(install => install.integration.id)
      .filter(id => overrides.get(id) ?? defaultExpandedById.get(id) ?? false);
    return new Set(expanded);
  }, [installations, overrides, defaultExpandedById]);

  const toggle = useCallback(
    (id: string) =>
      setOverrides(prev => {
        const next = new Map(prev);
        next.set(id, !(prev.get(id) ?? defaultExpandedById.get(id) ?? false));
        return next;
      }),
    [defaultExpandedById]
  );

  return {expandedIds, toggle};
}

const ScmInstallationContext = createContext<Partial<ScmInstallation>>({});

/**
 * Returns the installation merged with any overrides from the nearest
 * `InstallationOverrideProvider`. When no provider is present the context
 * is empty and the installation is returned as-is.
 */
function useMergedInstallation(installation: ScmInstallation): ScmInstallation {
  const overrides = useContext(ScmInstallationContext);
  return useMemo(() => ({...installation, ...overrides}), [installation, overrides]);
}

interface InstallationPanelProps {
  expanded: boolean;
  installation: ScmInstallation;
  onToggle: () => void;
  provider: IntegrationProvider;
  repoMatches?: ScmRepoMatches;
}

function InstallationPanel({
  installation,
  provider,
  expanded,
  onToggle,
  repoMatches,
}: InstallationPanelProps) {
  const merged = useMergedInstallation(installation);
  const {expandDisabled} = merged;
  const isExpanded = expanded && !expandDisabled;

  const handleHeaderClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (expandDisabled) {
      return;
    }
    const interactive = (event.target as HTMLElement).closest('a, button');
    if (interactive && interactive !== event.currentTarget) {
      return;
    }
    onToggle();
  };

  const handleHeaderKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (expandDisabled || event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggle();
    }
  };

  return (
    <Stack
      role="region"
      aria-label={merged.integration.name}
      border="primary"
      radius="md"
      overflow="hidden"
    >
      <ExpandableHeader
        role="button"
        tabIndex={expandDisabled ? -1 : 0}
        aria-label={merged.integration.name}
        aria-expanded={expandDisabled ? undefined : isExpanded}
        aria-disabled={expandDisabled || undefined}
        onClick={handleHeaderClick}
        onKeyDown={handleHeaderKeyDown}
      >
        <Flex align="center" gap="sm">
          <IconChevron direction={isExpanded ? 'up' : 'right'} />
          <IntegrationSummary installation={merged} />
        </Flex>
        <Flex align="center" gap="sm">
          <Flex align="center" gap="sm" paddingRight="lg" borderRight="secondary">
            <Flex display={{xs: 'none', sm: 'flex'}}>
              <InstallationRepoCountTag installation={merged} />
            </Flex>
            {merged.manageUrl && (
              <ManageLink href={merged.manageUrl} providerName={provider.name} />
            )}
          </Flex>
          <InstallationActions installation={merged} />
        </Flex>
      </ExpandableHeader>
      {isExpanded && (
        <VirtualizedRepoList
          installation={merged}
          repoMatches={repoMatches}
          providerName={provider.name}
        />
      )}
    </Stack>
  );
}

function InstallationRepoCountTag({installation}: {installation: ScmInstallation}) {
  const {repositories, reposLoading, isSyncing, integration} = installation;

  if (integration.status === 'disabled') {
    return null;
  }

  const rawLastSync = integration.configData?.last_sync;
  const lastSync = typeof rawLastSync === 'string' ? rawLastSync : undefined;
  const isLoading = reposLoading || isSyncing;

  return (
    <Tooltip
      isHoverable={!isLoading}
      title={getRepoCountTooltip(installation, lastSync)}
      skipWrapper
    >
      <Tag
        variant="muted"
        icon={isLoading ? <StatusIndicator variant="accent" /> : <IconInfo />}
      >
        <Text as="span" tabular>
          {tn('%s repository', '%s repositories', repositories.length)}
        </Text>
      </Tag>
    </Tooltip>
  );
}

function IntegrationSummary({installation}: {installation: ScmInstallation}) {
  const {integration} = installation;
  return (
    <Fragment>
      {getIntegrationIcon(integration.provider.key, 'sm')}
      <Text bold>{integration.name}</Text>
      {integration.status === 'disabled' && <Tag variant="danger">{t('Disabled')}</Tag>}
    </Fragment>
  );
}

interface InstallationActionsProps {
  installation: ScmInstallation;
}

function ManageLink({href, providerName}: {href: string; providerName: string}) {
  const theme = useTheme();
  const isSmallScreen = useMedia(`(max-width: ${theme.breakpoints.sm})`);
  return (
    <NeutralLinkButton
      tooltipProps={{
        title: t('Add or remove repository access on %s', providerName),
      }}
      href={href}
      external
      variant="link"
      size="xs"
      icon={<IconOpen />}
    >
      {isSmallScreen ? undefined : t('Manage')}
    </NeutralLinkButton>
  );
}

function getRepoCountTooltip(
  installation: ScmInstallation,
  lastSync: string | undefined
): React.ReactNode {
  const {reposLoading, isSyncing, onSync} = installation;

  if (reposLoading) {
    return t('Loading repositories');
  }
  if (isSyncing) {
    return t('Re-syncing in the background…');
  }

  const syncNowButton = onSync ? (
    <Button size="xs" variant="link" onClick={onSync}>
      {t('Sync now')}
    </Button>
  ) : null;

  if (lastSync) {
    return tct('Repositories last synced to Sentry [date]. [syncNow]', {
      date: (
        <strong>
          <TimeSince disabledAbsoluteTooltip date={lastSync} />
        </strong>
      ),
      syncNow: syncNowButton,
    });
  }
  return tct('Repositories not yet synced. [syncNow]', {syncNow: syncNowButton});
}

function InstallationActions({installation}: InstallationActionsProps) {
  const {
    overflowMenuItems,
    settingsButtonProps,
    uninstallButtonProps,
    onSettings,
    onUninstall,
  } = installation;

  if (!onUninstall && !onSettings && !overflowMenuItems?.length) {
    return null;
  }

  return (
    <Flex align="center" gap="2xs">
      {onUninstall && (
        <Button
          aria-label={t('Uninstall')}
          size="xs"
          variant="transparent"
          icon={<IconDelete />}
          {...uninstallButtonProps}
          onClick={onUninstall}
        />
      )}
      {onSettings && (
        <Button
          aria-label={t('Integration settings')}
          size="xs"
          variant="transparent"
          icon={<IconSliders />}
          {...settingsButtonProps}
          onClick={onSettings}
        />
      )}
      {overflowMenuItems && overflowMenuItems.length > 0 && (
        <DropdownMenu
          items={overflowMenuItems}
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
      )}
    </Flex>
  );
}

function RepoMappings({
  slugs,
  mappingsLoading,
  action,
}: {
  mappingsLoading: boolean | undefined;
  slugs: string[];
  action?: React.ReactNode;
}) {
  return (
    <Flex align="center" gap="2xs">
      {slugs.length > 0 && <ProjectList projectSlugs={slugs} maxVisibleProjects={3} />}
      {mappingsLoading && slugs.length === 0 && (
        <Placeholder width="60px" height="16px" />
      )}
      {action}
    </Flex>
  );
}

interface VirtualizedRepoListProps {
  installation: ScmInstallation;
  providerName: string;
  repoMatches?: ScmRepoMatches;
}

function VirtualizedRepoList({
  installation,
  repoMatches,
  providerName,
}: VirtualizedRepoListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    repositories,
    manageUrl,
    reposLoading: isLoading,
    mappedProjectSlugsByRepoId,
    mappingsLoading,
  } = installation;

  const visibleRepos = useMemo(() => {
    const filtered =
      repoMatches === undefined
        ? repositories
        : repositories.filter(r => repoMatches[r.id]);
    const hasMapping = (id: string) =>
      (mappedProjectSlugsByRepoId?.[id]?.length ?? 0) > 0;

    return sortBy(filtered, [r => !hasMapping(r.id), r => r.name]);
  }, [repositories, repoMatches, mappedProjectSlugsByRepoId]);

  const virtualizer = useVirtualizer({
    count: visibleRepos.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_REPO_ROW_HEIGHT,
    overscan: 6,
    getItemKey: i => visibleRepos[i]!.id,
  });

  const renderEmptyMessage = () => {
    if (isLoading) {
      return (
        <Flex align="center" gap="sm">
          <StatusIndicator variant="accent" />
          <Text variant="muted">{t('Loading repositories')}</Text>
        </Flex>
      );
    }
    if (repoMatches !== undefined && repositories.length > 0) {
      return <Text variant="muted">{t('No repositories match your search')}</Text>;
    }
    return (
      <Text variant="muted">
        {manageUrl
          ? tct('No repositories available. [link:Manage repository access]', {
              link: <ExternalLink href={manageUrl} />,
            })
          : t('No repositories available.')}
      </Text>
    );
  };

  if (visibleRepos.length === 0) {
    return (
      <Flex padding="xl xl" justify="center" borderTop="primary">
        {renderEmptyMessage()}
      </Flex>
    );
  }

  return (
    <Stack borderTop="primary">
      <Flex
        justify="between"
        align="center"
        padding="lg 3xl"
        borderBottom="primary"
        background="secondary"
      >
        <Text as="span" variant="secondary" size="sm" uppercase bold>
          {t('Repositories')}
        </Text>
        <Text as="span" variant="secondary" size="sm" uppercase bold>
          {t('Connected Projects')}
        </Text>
      </Flex>
      <Container
        ref={scrollRef}
        role="list"
        aria-label={t('Repositories')}
        maxHeight={`${REPO_LIST_MAX_HEIGHT}px`}
        overflowY="auto"
        position="relative"
      >
        <Container position="relative" style={{height: virtualizer.getTotalSize()}}>
          {virtualizer.getVirtualItems().map(virtualItem => {
            const repo = visibleRepos[virtualItem.index]!;
            const nameMatch = repoMatches?.[repo.id]?.find(m => m.key === 'name');
            const isLast = virtualItem.index === visibleRepos.length - 1;
            return (
              <Fragment key={virtualItem.key}>
                <Container
                  position="absolute"
                  top="0"
                  left="0"
                  right="0"
                  borderBottom={isLast ? undefined : 'secondary'}
                  style={{
                    transform: `translateY(${virtualItem.start}px)`,
                    height: virtualItem.size,
                  }}
                />
                <RepoRow
                  role="listitem"
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  position="absolute"
                  top="0"
                  left="0"
                  right="0"
                  align="center"
                  justify="between"
                  gap="sm"
                  padding="lg 3xl"
                  style={{transform: `translateY(${virtualItem.start}px)`}}
                >
                  <Flex align="center" gap="sm" minWidth="0">
                    {repo.url ? (
                      <Fragment>
                        <RepoNameLink href={repo.url}>
                          {nameMatch
                            ? highlightFuseMatches(nameMatch, HighlightMark)
                            : repo.name}
                        </RepoNameLink>
                        <LinkButton
                          className="hover-reveal"
                          href={repo.url}
                          external
                          size="zero"
                          variant="transparent"
                          icon={<IconOpen variant="muted" />}
                          aria-label={t('View repository on %s', providerName)}
                          tooltipProps={{
                            title: t('View repository on %s', providerName),
                          }}
                        />
                      </Fragment>
                    ) : (
                      <Text>
                        {nameMatch
                          ? highlightFuseMatches(nameMatch, HighlightMark)
                          : repo.name}
                      </Text>
                    )}
                  </Flex>
                  {mappedProjectSlugsByRepoId && (
                    <RepoMappings
                      slugs={mappedProjectSlugsByRepoId[repo.id] ?? []}
                      mappingsLoading={mappingsLoading}
                      action={installation.repoActions?.(repo)}
                    />
                  )}
                </RepoRow>
              </Fragment>
            );
          })}
        </Container>
      </Container>
    </Stack>
  );
}

const ExpandableHeader = styled('div')`
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  min-height: 36px;

  &[aria-disabled='true'] {
    cursor: default;
  }

  &:not([aria-disabled='true']):hover {
    background: ${p => p.theme.tokens.background.secondary};
  }

  &:focus-visible {
    outline: 2px solid ${p => p.theme.tokens.focus.default};
    outline-offset: -2px;
  }

  &:not([aria-disabled='true']):active {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.active};
  }
`;

const NeutralLinkButton = styled(LinkButton)`
  color: ${p => p.theme.tokens.interactive.link.neutral.rest};

  &:hover {
    color: ${p => p.theme.tokens.interactive.link.neutral.hover};
  }
`;

const RepoRow = styled(Flex)`
  .hover-reveal {
    opacity: 0;
    transition: opacity 100ms;
  }
  &:hover .hover-reveal,
  &:focus-within .hover-reveal {
    opacity: 1;
  }
`;

const RepoNameLink = styled(ExternalLink)`
  color: ${p => p.theme.tokens.content.primary};
  text-decoration: none;

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const HighlightMark = styled('mark')`
  background-color: ${p => p.theme.tokens.background.transparent.warning.muted};
  color: inherit;
  border-radius: ${p => p.theme.radius.xs};
`;
