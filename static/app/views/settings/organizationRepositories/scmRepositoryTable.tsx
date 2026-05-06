import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled from '@emotion/styled';
import {useVirtualizer} from '@tanstack/react-virtual';
import sortBy from 'lodash/sortBy';

import {Tag} from '@sentry/scraps/badge';
import {Button, type ButtonProps, LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {Panel} from 'sentry/components/panels/panel';
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
import type {
  IntegrationProvider,
  OrganizationIntegration,
  Repository,
} from 'sentry/types/integrations';
import type {Fuse} from 'sentry/utils/fuzzySearch';
import {highlightFuseMatches} from 'sentry/utils/highlightFuseMatches';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';

const REPO_LIST_MAX_HEIGHT = 400;
const ESTIMATED_REPO_ROW_HEIGHT = 32;

/**
 * Fuse match results keyed by `repository.id`, used to highlight the matched
 * portions of repository names in the table.
 */
export type ScmRepoMatches = Record<string, readonly Fuse.FuseResultMatch[]>;

export interface ScmInstallation {
  /**
   * The installed integration this row represents.
   */
  integration: OrganizationIntegration;
  /**
   * Repositories under this installation. Empty arrays render an empty-state
   * message in place of the row list.
   */
  repositories: Repository[];
  /**
   * When true, the installation header is rendered as a non-toggleable row
   * (can't be expanded). Use for disabled/inactive integrations whose
   * repos shouldn't be exposed.
   */
  expandDisabled?: boolean;
  /**
   * Whether the installation should start expanded. Single-installation
   * tables auto-expand regardless of this flag.
   */
  initiallyExpanded?: boolean;
  /**
   * When true, the tag icon switches to a loading indicator and the tooltip
   * shows "Re-syncing in the background…" instead of the sync button.
   */
  isSyncing?: boolean;
  /**
   * Optional URL to the upstream provider's installation-management page
   * (e.g. GitHub's app settings). Surfaced as a "Manage repositories" link in
   * the empty state and the no-search-results state.
   */
  manageUrl?: string;
  /**
   * Project slugs keyed by `repository.id` for repos that have code mappings.
   * Each repo with one or more slugs renders a stack of project avatars on the
   * right of its row, with a hover tooltip identifying each project. When the
   * key is undefined, the right-side button + project list slot is hidden
   * entirely (use this when mapping data isn't available at all, vs. an empty
   * record which means "loaded, this repo has no mappings").
   */
  mappedProjectSlugsByRepoId?: Record<string, string[]>;
  /**
   * Whether code mappings are still being fetched. When true, rows that don't
   * yet have any mapped slugs render a `<Placeholder>` skeleton in place of
   * the project list, so users see an inline loading hint without blocking
   * the rest of the row.
   */
  mappingsLoading?: boolean;
  /**
   * Called when the user clicks the settings button. When omitted the button
   * is hidden.
   */
  onSettings?: () => void;
  /**
   * Called when the user clicks "Sync now" in the repository count tag
   * tooltip. When omitted the button is hidden.
   */
  onSync?: () => void;
  /**
   * Called when the user clicks the uninstall button. When omitted the button
   * is hidden.
   */
  onUninstall?: () => void;
  /**
   * Items rendered into the per-installation overflow (`...`) menu. When
   * omitted or empty, the menu trigger is hidden.
   */
  overflowMenuItems?: MenuItemProps[];
  /**
   * Renders an action element in the right slot of each repository row.
   * Only called when `mappedProjectSlugsByRepoId` is set on the installation.
   */
  repoActions?: (repo: Repository) => React.ReactNode;
  /**
   * Whether the parent is still fetching the repository list. Drives the
   * "Loading repositories" empty state and shows a loading indicator
   * alongside the repository count tag.
   */
  reposLoading?: boolean;
  /**
   * Props forwarded to the settings button. Use to disable or annotate it
   * while per-integration config is still being fetched.
   */
  settingsButtonProps?: Omit<ButtonProps, 'onClick'>;
  /**
   * Props forwarded to the uninstall button. Use to disable or annotate it
   * when the viewer lacks the required access.
   */
  uninstallButtonProps?: Omit<ButtonProps, 'onClick'>;
}

export interface InstallationWrapperProps {
  children: React.ReactNode;
  installation: ScmInstallation;
}

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

export function ScmRepositoryTable({installations, ...rest}: ScmRepositoryTableProps) {
  const soleInstallation = installations.length === 1 ? installations[0]! : null;

  if (soleInstallation !== null) {
    return <SingleInstallTable installation={soleInstallation} {...rest} />;
  }

  return <MultiInstallTable installations={installations} {...rest} />;
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

  const defaultExpandedById = useMemo(
    () =>
      new Map(installations.map(i => [i.integration.id, i.initiallyExpanded ?? false])),
    [installations]
  );

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

interface SoloInstallTableProps extends Omit<ScmRepositoryTableProps, 'installations'> {
  installation: ScmInstallation;
}

function SingleInstallTable({
  installation,
  installationWrapper: Wrapper,
  ...rest
}: SoloInstallTableProps) {
  const content = <SingleInstallTableContent installation={installation} {...rest} />;
  return Wrapper ? <Wrapper installation={installation}>{content}</Wrapper> : content;
}

function SingleInstallTableContent({
  provider,
  installation,
  repoMatches,
}: SoloInstallTableProps) {
  const merged = useMergedInstallation(installation);

  return (
    <Panel role="region" aria-label={provider.name}>
      <TableHeader>
        <Flex align="center" gap="sm">
          {getIntegrationIcon(provider.key, 'sm')}
          <Text bold>{provider.name}</Text>
          <Text variant="muted">/</Text>
          <IntegrationSummary installation={merged} />
        </Flex>
        <Flex align="center" gap="sm">
          <InstallationActions installation={merged} providerName={provider.name} />
        </Flex>
      </TableHeader>
      <VirtualizedRepoList
        installation={merged}
        repoMatches={repoMatches}
        providerName={provider.name}
      />
    </Panel>
  );
}

function MultiInstallTable({
  provider,
  installations,
  installationWrapper: Wrapper,
  repoMatches,
}: ScmRepositoryTableProps) {
  const {expandedIds, toggle} = useExpandedInstallations(installations);

  return (
    <Panel role="region" aria-label={provider.name}>
      <TableHeader>
        <Flex align="center" gap="sm">
          {getIntegrationIcon(provider.key, 'sm')}
          <Text bold>{provider.name}</Text>
        </Flex>
      </TableHeader>
      <Grid role="list" columns="max-content 1fr" gap="0 md">
        {installations.map(installation => {
          const hasSearchHits =
            repoMatches !== undefined &&
            installation.repositories.some(r => repoMatches[r.id]);
          const row = (
            <InstallationRow
              provider={provider}
              installation={installation}
              expanded={hasSearchHits || expandedIds.has(installation.integration.id)}
              onToggle={() => toggle(installation.integration.id)}
              repoMatches={repoMatches}
            />
          );
          return Wrapper ? (
            <Wrapper key={installation.integration.id} installation={installation}>
              <InstallationSubgrid role="listitem">{row}</InstallationSubgrid>
            </Wrapper>
          ) : (
            <InstallationSubgrid key={installation.integration.id} role="listitem">
              {row}
            </InstallationSubgrid>
          );
        })}
      </Grid>
    </Panel>
  );
}

function TableHeader({children}: {children: React.ReactNode}) {
  return (
    <Flex
      justify="between"
      background="secondary"
      padding="xs lg"
      radius="sm sm 0 0"
      borderBottom="secondary"
      minHeight="36px"
    >
      {children}
    </Flex>
  );
}

interface InstallationRowProps {
  expanded: boolean;
  installation: ScmInstallation;
  onToggle: () => void;
  provider: IntegrationProvider;
  repoMatches?: ScmRepoMatches;
}

function InstallationRow({
  provider,
  installation,
  expanded,
  onToggle,
  repoMatches,
}: InstallationRowProps) {
  const merged = useMergedInstallation(installation);
  const {expandDisabled} = merged;

  const handleRowClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (expandDisabled) {
      return;
    }
    const interactive = (event.target as HTMLElement).closest('a, button');
    if (interactive && interactive !== event.currentTarget) {
      return;
    }
    onToggle();
  };

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (expandDisabled || event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggle();
    }
  };

  return (
    <Fragment>
      <RowButton
        role="button"
        tabIndex={expandDisabled ? -1 : 0}
        aria-label={merged.integration.name}
        aria-expanded={expandDisabled ? undefined : expanded}
        aria-disabled={expandDisabled || undefined}
        onClick={handleRowClick}
        onKeyDown={handleRowKeyDown}
      >
        <IconChevron direction={expanded && !expandDisabled ? 'down' : 'right'} />
        <Flex column="2" align="center" justify="between" gap="md">
          <Flex align="center" gap="sm">
            <IntegrationSummary installation={merged} />
          </Flex>
          <Flex align="center" gap="md">
            <InstallationActions installation={merged} providerName={provider.name} />
          </Flex>
        </Flex>
      </RowButton>
      {expanded && !expandDisabled && (
        <VirtualizedRepoList
          installation={merged}
          repoMatches={repoMatches}
          providerName={provider.name}
          nested
        />
      )}
    </Fragment>
  );
}

function IntegrationSummary({installation}: {installation: ScmInstallation}) {
  const {integration} = installation;
  return (
    <Fragment>
      {getIntegrationIcon(integration.provider.key, 'sm')}
      <Text bold>{integration.name}</Text>
      {integration.status === 'disabled' && <Tag variant="warning">{t('Disabled')}</Tag>}
    </Fragment>
  );
}

interface InstallationActionsProps {
  installation: ScmInstallation;
  providerName: string;
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

function InstallationActions({installation, providerName}: InstallationActionsProps) {
  const {
    manageUrl,
    overflowMenuItems,
    settingsButtonProps,
    uninstallButtonProps,
    repositories,
    reposLoading,
    isSyncing,
    onSettings,
    onUninstall,
    integration,
  } = installation;

  const isDisabled = integration.status === 'disabled';
  const rawLastSync = integration.configData?.last_sync;
  const lastSync = typeof rawLastSync === 'string' ? rawLastSync : undefined;

  const isLoading = reposLoading || isSyncing;
  const repoCountTooltip = getRepoCountTooltip(installation, lastSync);

  return (
    <Fragment>
      {!isDisabled && (
        <Tooltip isHoverable={!isLoading} title={repoCountTooltip} skipWrapper>
          <Tag
            variant="muted"
            icon={isLoading ? <StatusIndicator variant="accent" /> : <IconInfo />}
          >
            {tn('%s repository', '%s repositories', repositories.length)}
          </Tag>
        </Tooltip>
      )}
      {manageUrl && (
        <LinkButton
          tooltipProps={{
            title: t('Add or remove repository access on %s', providerName),
          }}
          href={manageUrl}
          external
          variant="link"
          size="xs"
          icon={<IconOpen />}
        >
          {t('Manage repositories')}
        </LinkButton>
      )}
      {(onUninstall || onSettings || !!overflowMenuItems?.length) && (
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
      )}
    </Fragment>
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
  nested?: boolean;
  repoMatches?: ScmRepoMatches;
}

function VirtualizedRepoList({
  installation,
  repoMatches,
  providerName,
  nested = false,
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

  const outerColumn = nested ? '1/-1' : undefined;
  const outerColumns = nested ? 'subgrid' : '1fr';
  const contentColumn = nested ? '2' : undefined;

  const items =
    visibleRepos.length === 0 ? (
      <Flex column={contentColumn} padding="md xl" justify="center">
        {renderEmptyMessage()}
      </Flex>
    ) : (
      <Grid
        column={outerColumn}
        columns={outerColumns}
        position="relative"
        style={{height: virtualizer.getTotalSize()}}
      >
        {virtualizer.getVirtualItems().map(virtualItem => {
          const repo = visibleRepos[virtualItem.index]!;
          const nameMatch = repoMatches?.[repo.id]?.find(m => m.key === 'name');
          const isLast = virtualItem.index === visibleRepos.length - 1;
          return (
            <Fragment key={virtualItem.key}>
              <Container
                column="1/-1"
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
                column={contentColumn}
                position="absolute"
                top="0"
                left="0"
                right="0"
                align="center"
                justify="between"
                gap="sm"
                padding={nested ? 'xs xl xs 0' : 'xs lg'}
                style={{transform: `translateY(${virtualItem.start}px)`}}
              >
                <Flex align="center" gap="sm" minWidth="0">
                  <Text>
                    {nameMatch
                      ? highlightFuseMatches(nameMatch, HighlightMark)
                      : repo.name}
                  </Text>
                  <LinkButton
                    className="hover-reveal"
                    href={repo.url ?? ''}
                    external
                    size="zero"
                    variant="transparent"
                    icon={<IconOpen variant="muted" />}
                    aria-label={t('View repository on %s', providerName)}
                    tooltipProps={{
                      title: t('View repository on %s', providerName),
                    }}
                  />
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
      </Grid>
    );

  const commonProps = {
    ref: scrollRef,
    role: 'list',
    'aria-label': t('Repositories'),
    maxHeight: `${REPO_LIST_MAX_HEIGHT}px`,
    overflowY: 'auto',
    position: 'relative',
  } as const;

  return nested ? (
    <Grid {...commonProps} column={outerColumn} columns={outerColumns}>
      {items}
    </Grid>
  ) : (
    <Container {...commonProps}>{items}</Container>
  );
}

const InstallationSubgrid = styled('div')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const RowButton = styled('div')`
  cursor: pointer;

  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  align-items: center;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};

  &[aria-expanded='true'] {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }

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

const HighlightMark = styled('mark')`
  background-color: ${p => p.theme.tokens.background.transparent.warning.muted};
  color: inherit;
  border-radius: ${p => p.theme.radius.xs};
`;
