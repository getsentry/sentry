import {Fragment, type ReactNode, useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useVirtualizer} from '@tanstack/react-virtual';

import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
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
  IconOpen,
  IconSliders,
  IconSync,
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
const ESTIMATED_REPO_ROW_HEIGHT = 36;

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
   * Items rendered into the per-installation overflow (`...`) menu. When
   * omitted or empty, the menu trigger is hidden.
   */
  overflowMenuItems?: MenuItemProps[];
  /**
   * Whether the parent is still fetching the repository list. Drives the
   * "Loading repositories" empty state and hides the repo-count tag while
   * `repositories` is still empty.
   */
  reposLoading?: boolean;
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
   * When provided, renders a "Last synced N ago" label in the footer.
   */
  lastSyncedAt?: Date;
  /**
   * Called when the user clicks the settings button for an installation.
   * When omitted the button is hidden.
   */
  onSettings?: (installation: ScmInstallation) => void;
  /**
   * When provided, renders a Sync button in the footer.
   */
  onSync?: () => void;
  /**
   * Called when the user clicks the uninstall button for an installation.
   * When omitted the button is hidden.
   */
  onUninstall?: (installation: ScmInstallation) => void;
  /**
   * Renders an action element in the right slot of each repository row.
   * Only called when `mappedProjectSlugsByRepoId` is set on the installation.
   */
  repoActions?: (repo: Repository, installation: ScmInstallation) => ReactNode;
  /**
   * Fuse match results used to filter and highlight repo names.
   */
  repoMatches?: ScmRepoMatches;
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

export function ScmRepositoryTable({
  provider,
  installations,
  lastSyncedAt,
  onSettings,
  onSync,
  onUninstall,
  repoActions,
  repoMatches,
}: ScmRepositoryTableProps) {
  const showFooter = lastSyncedAt !== undefined || onSync !== undefined;
  const soleInstallation = installations.length === 1 ? installations[0]! : null;

  const {expandedIds, toggle} = useExpandedInstallations(installations);

  return (
    <Panel role="region" aria-label={provider.name}>
      <Flex
        justify="between"
        background="secondary"
        padding="xs lg"
        radius="sm sm 0 0"
        borderBottom="secondary"
        minHeight="36px"
      >
        <Flex align="center" gap="sm">
          {getIntegrationIcon(provider.key, 'sm')}
          <Text bold>{provider.name}</Text>
          {soleInstallation && (
            <Fragment>
              <Text variant="muted">/</Text>
              <IntegrationSummary installation={soleInstallation} />
            </Fragment>
          )}
        </Flex>
        <Flex align="center" gap="sm">
          {soleInstallation && (
            <InstallationActions
              installation={soleInstallation}
              providerName={provider.name}
              onUninstall={onUninstall}
              onSettings={onSettings}
            />
          )}
        </Flex>
      </Flex>
      {soleInstallation ? (
        <VirtualizedRepoList
          installation={soleInstallation}
          repoMatches={repoMatches}
          providerName={provider.name}
          repoActions={repoActions}
        />
      ) : (
        <Grid role="list" columns="max-content 1fr" gap="0 md">
          {installations.map(installation => {
            const hasSearchHits =
              repoMatches !== undefined &&
              installation.repositories.some(r => repoMatches[r.id]);
            return (
              <InstallationSubgrid key={installation.integration.id} role="listitem">
                <InstallationRow
                  provider={provider}
                  installation={installation}
                  expanded={hasSearchHits || expandedIds.has(installation.integration.id)}
                  onToggle={() => toggle(installation.integration.id)}
                  onUninstall={onUninstall}
                  onSettings={onSettings}
                  repoActions={repoActions}
                  repoMatches={repoMatches}
                />
              </InstallationSubgrid>
            );
          })}
        </Grid>
      )}
      {showFooter && (
        <Flex
          align="center"
          gap="md"
          background="secondary"
          borderTop="primary"
          radius="0 0 md md"
          padding="md xl"
        >
          {lastSyncedAt !== undefined && (
            <Text variant="muted" size="sm">
              {tct('Last synced [timeSince] ago', {
                timeSince: <TimeSince date={lastSyncedAt} suffix="" />,
              })}
            </Text>
          )}
          {onSync && (
            <Button
              variant="transparent"
              size="zero"
              icon={<IconSync size="xs" />}
              onClick={onSync}
            >
              {t('Sync')}
            </Button>
          )}
        </Flex>
      )}
    </Panel>
  );
}

interface InstallationRowProps {
  expanded: boolean;
  installation: ScmInstallation;
  onToggle: () => void;
  provider: IntegrationProvider;
  onSettings?: (installation: ScmInstallation) => void;
  onUninstall?: (installation: ScmInstallation) => void;
  repoActions?: (repo: Repository, installation: ScmInstallation) => ReactNode;
  repoMatches?: ScmRepoMatches;
}

function InstallationRow({
  provider,
  installation,
  expanded,
  onToggle,
  onUninstall,
  onSettings,
  repoActions,
  repoMatches,
}: InstallationRowProps) {
  const {expandDisabled} = installation;

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
        aria-label={installation.integration.name}
        aria-expanded={expandDisabled ? undefined : expanded}
        aria-disabled={expandDisabled || undefined}
        onClick={handleRowClick}
        onKeyDown={handleRowKeyDown}
      >
        <IconChevron direction={expanded && !expandDisabled ? 'down' : 'right'} />
        <Flex column="2" align="center" justify="between" gap="md">
          <Flex align="center" gap="sm">
            <IntegrationSummary installation={installation} />
          </Flex>
          <Flex align="center" gap="md">
            <InstallationActions
              installation={installation}
              providerName={provider.name}
              onUninstall={onUninstall}
              onSettings={onSettings}
            />
          </Flex>
        </Flex>
      </RowButton>
      {expanded && !expandDisabled && (
        <VirtualizedRepoList
          installation={installation}
          repoMatches={repoMatches}
          providerName={provider.name}
          repoActions={repoActions}
          nested
        />
      )}
    </Fragment>
  );
}

function IntegrationSummary({installation}: {installation: ScmInstallation}) {
  const {integration, repositories, reposLoading} = installation;
  return (
    <Fragment>
      {getIntegrationIcon(integration.provider.key, 'sm')}
      <Text bold>{integration.name}</Text>
      {integration.status === 'disabled' ? (
        <Tag variant="warning">{t('Disabled')}</Tag>
      ) : (
        <Fragment>
          <Tag variant="muted">{tn('%s repo', '%s repos', repositories.length)}</Tag>
          {reposLoading && (
            <Tooltip title={t('Loading repositories')} skipWrapper>
              <StatusIndicator variant="accent" />
            </Tooltip>
          )}
        </Fragment>
      )}
    </Fragment>
  );
}

interface InstallationActionsProps {
  installation: ScmInstallation;
  providerName: string;
  onSettings?: (installation: ScmInstallation) => void;
  onUninstall?: (installation: ScmInstallation) => void;
}

function InstallationActions({
  installation,
  providerName,
  onUninstall,
  onSettings,
}: InstallationActionsProps) {
  const {manageUrl, overflowMenuItems} = installation;
  return (
    <Fragment>
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
              onClick={() => onUninstall(installation)}
            />
          )}
          {onSettings && (
            <Button
              aria-label={t('Integration settings')}
              size="xs"
              variant="transparent"
              icon={<IconSliders />}
              onClick={() => onSettings(installation)}
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
  action?: ReactNode;
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
  repoActions?: (repo: Repository, installation: ScmInstallation) => ReactNode;
  repoMatches?: ScmRepoMatches;
}

function VirtualizedRepoList({
  installation,
  repoMatches,
  providerName,
  repoActions,
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
    return [...filtered].sort((a, b) => {
      const aHas = hasMapping(a.id);
      const bHas = hasMapping(b.id);
      if (aHas !== bHas) return aHas ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
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
                    action={repoActions?.(repo, installation)}
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
    <Flex {...commonProps} direction="column">
      {items}
    </Flex>
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
