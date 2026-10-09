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
import {IconChevron} from '@sentry/icons/chevron';
import {IconDelete} from '@sentry/icons/delete';
import {IconEllipsis} from '@sentry/icons/ellipsis';
import {IconInfo} from '@sentry/icons/info';
import {IconOpen} from '@sentry/icons/open';
import {IconSliders} from '@sentry/icons/sliders';
import groupBy from 'lodash/groupBy';
import sortBy from 'lodash/sortBy';

import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Flex, useResponsivePropValue} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Table, type TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';
import {ProjectList} from 'sentry/components/projectList';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {useVirtualRows} from 'sentry/components/tables/useVirtualRows';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct, tn} from 'sentry/locale';
import type {IntegrationProvider, Repository} from 'sentry/types/integrations';
import type {AvatarProject} from 'sentry/types/project';
import {highlightFuseMatches} from 'sentry/utils/highlightFuseMatches';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import type {
  ScmInstallation,
  ScmRepoMatches,
} from 'sentry/views/settings/organizationRepositories/types';

export interface InstallationWrapperProps {
  children: React.ReactNode;
  installation: ScmInstallation;
}

const TABLE_MAX_HEIGHT = 400;
const ESTIMATED_ROW_HEIGHT = 49;

const COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: 'minmax(0, 1fr)'},
  {key: 'projects', width: 'max-content'},
];

function EmptyRepositoryMessage({
  isLoading,
  manageUrl,
  repositories,
  repoMatches,
}: {
  repositories: Repository[];
  isLoading?: boolean;
  manageUrl?: string;
  repoMatches?: ScmRepoMatches;
}) {
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
   * `InstallationOverrideProvider`. It renders inside the table, so it must not
   * render any elements of its own.
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

type InstallationOverrides = Partial<
  Omit<ScmInstallation, 'repositories' | 'mappedProjectSlugsByRepoId' | 'expandDisabled'>
>;

interface OverrideProviderProps {
  children: React.ReactNode;
  value: InstallationOverrides;
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

const ScmInstallationContext = createContext<InstallationOverrides>({});

/**
 * Returns the installation merged with any overrides from the nearest
 * `InstallationOverrideProvider`. When no provider is present the context
 * is empty and the installation is returned as-is.
 */
function useMergedInstallation(installation: ScmInstallation): ScmInstallation {
  const overrides = useContext(ScmInstallationContext);
  return useMemo(() => ({...installation, ...overrides}), [installation, overrides]);
}

type TableItem =
  | {
      expanded: boolean;
      installation: ScmInstallation;
      key: string;
      onToggle: () => void;
      type: 'installation';
    }
  | {
      installation: ScmInstallation;
      key: string;
      repo: Repository;
      type: 'repo';
    }
  | {installation: ScmInstallation; key: string; type: 'empty'};

function getRepoItems(
  installation: ScmInstallation,
  repoMatches: ScmRepoMatches | undefined
): TableItem[] {
  const {repositories, mappedProjectSlugsByRepoId} = installation;
  const id = installation.integration.id;
  const filtered =
    repoMatches === undefined
      ? repositories
      : repositories.filter(r => repoMatches[r.id]);
  const hasMapping = (repoId: string) =>
    (mappedProjectSlugsByRepoId?.[repoId]?.length ?? 0) > 0;
  const visibleRepos = sortBy(filtered, [r => !hasMapping(r.id), r => r.name]);

  if (visibleRepos.length === 0) {
    return [{type: 'empty', key: `${id}:empty`, installation}];
  }

  return visibleRepos.map(repo => ({
    type: 'repo',
    key: `${id}:repo:${repo.id}`,
    installation,
    repo,
  }));
}

function useVirtualTableRows(items: TableItem[]) {
  const tableRef = useRef<HTMLTableElement>(null);

  const getItemKey = useCallback((index: number) => items[index]!.key, [items]);

  const {paddingBottom, paddingTop, virtualItems, virtualizer} = useVirtualRows({
    count: items.length,
    getScrollElement: () => tableRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 6,
    getItemKey,
  });

  return {
    measureElement: virtualizer.measureElement,
    paddingBottom,
    paddingTop,
    tableRef,
    virtualItems,
  };
}

interface TableItemRowProps {
  index: number;
  item: TableItem;
  measureElement: (element: Element | null) => void;
  providerName: string;
  repoMatches: ScmRepoMatches | undefined;
  nested?: boolean;
}

function TableItemRow({
  index,
  item,
  measureElement,
  nested,
  providerName,
  repoMatches,
}: TableItemRowProps) {
  switch (item.type) {
    case 'installation':
      return (
        <InstallationRow
          data-index={index}
          ref={measureElement}
          expanded={item.expanded}
          installation={item.installation}
          onToggle={item.onToggle}
          providerName={providerName}
        />
      );
    case 'repo':
      return (
        <RepoRow
          data-index={index}
          ref={measureElement}
          installation={item.installation}
          nested={nested}
          providerName={providerName}
          repo={item.repo}
          repoMatches={repoMatches}
        />
      );
    case 'empty':
      return (
        <EmptyRow
          data-index={index}
          ref={measureElement}
          installation={item.installation}
          repoMatches={repoMatches}
        />
      );
  }
}

interface RepositoryTableShellProps {
  children: React.ReactNode;
  header: React.ReactNode;
  paddingBottom: number;
  paddingTop: number;
  provider: IntegrationProvider;
  tableRef: React.RefObject<HTMLTableElement | null>;
}

function RepositoryTableShell({
  children,
  header,
  paddingBottom,
  paddingTop,
  provider,
  tableRef,
}: RepositoryTableShellProps) {
  return (
    <SimpleTable
      aria-label={provider.name}
      columns={COLUMNS}
      customSections
      maxHeight={`${TABLE_MAX_HEIGHT}px`}
      ref={tableRef}
      scrollable
    >
      <SimpleTable.Head sticky>
        <SimpleTable.HeaderRow>
          <ProviderHeaderCell>{header}</ProviderHeaderCell>
        </SimpleTable.HeaderRow>
      </SimpleTable.Head>
      <SimpleTable.Body style={{paddingBottom, paddingTop}}>{children}</SimpleTable.Body>
    </SimpleTable>
  );
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

  const items = useMemo(
    () => getRepoItems(installation, repoMatches),
    [installation, repoMatches]
  );

  const {measureElement, paddingBottom, paddingTop, tableRef, virtualItems} =
    useVirtualTableRows(items);

  return (
    <RepositoryTableShell
      provider={provider}
      tableRef={tableRef}
      paddingTop={paddingTop}
      paddingBottom={paddingBottom}
      header={
        <Fragment>
          <Flex align="center" gap="sm">
            {getIntegrationIcon(provider.key, 'sm')}
            <Text bold>{provider.name}</Text>
            <Text variant="muted">/</Text>
            <IntegrationSummary installation={merged} />
          </Flex>
          <Flex align="center" gap="sm">
            <Flex display={{zero: 'none', xl: 'flex'}}>
              <InstallationRepoCountTag installation={merged} />
            </Flex>
            <InstallationActions installation={merged} providerName={provider.name} />
          </Flex>
        </Fragment>
      }
    >
      {virtualItems.map(virtualItem => (
        <TableItemRow
          key={virtualItem.key}
          index={virtualItem.index}
          item={items[virtualItem.index]!}
          measureElement={measureElement}
          providerName={provider.name}
          repoMatches={repoMatches}
        />
      ))}
    </RepositoryTableShell>
  );
}

function MultiInstallTable({
  provider,
  installations,
  installationWrapper: Wrapper,
  repoMatches,
}: ScmRepositoryTableProps) {
  const {expandedIds, toggle} = useExpandedInstallations(installations);

  const items = useMemo(
    () =>
      installations.flatMap<TableItem>(installation => {
        const id = installation.integration.id;
        const hasSearchHits =
          repoMatches !== undefined &&
          installation.repositories.some(r => repoMatches[r.id]);
        const expanded = hasSearchHits || expandedIds.has(id);
        const row: TableItem = {
          type: 'installation',
          key: `${id}:installation`,
          installation,
          expanded,
          onToggle: () => toggle(id),
        };

        return expanded && !installation.expandDisabled
          ? [row, ...getRepoItems(installation, repoMatches)]
          : [row];
      }),
    [installations, expandedIds, toggle, repoMatches]
  );

  const {measureElement, paddingBottom, paddingTop, tableRef, virtualItems} =
    useVirtualTableRows(items);

  const virtualItemsByInstallationId = groupBy(
    virtualItems,
    virtualItem => items[virtualItem.index]!.installation.integration.id
  );

  return (
    <RepositoryTableShell
      provider={provider}
      tableRef={tableRef}
      paddingTop={paddingTop}
      paddingBottom={paddingBottom}
      header={
        <Flex align="center" gap="sm">
          {getIntegrationIcon(provider.key, 'sm')}
          <Text bold>{provider.name}</Text>
        </Flex>
      }
    >
      {installations.map(installation => {
        const id = installation.integration.id;
        // Every wrapper stays mounted, even with all of its rows scrolled out of
        // view, so per-installation state such as sync polling keeps running.
        const rows = (virtualItemsByInstallationId[id] ?? []).map(virtualItem => (
          <TableItemRow
            key={virtualItem.key}
            index={virtualItem.index}
            item={items[virtualItem.index]!}
            measureElement={measureElement}
            providerName={provider.name}
            repoMatches={repoMatches}
            nested
          />
        ));

        return Wrapper ? (
          <Wrapper key={id} installation={installation}>
            {rows}
          </Wrapper>
        ) : (
          <Fragment key={id}>{rows}</Fragment>
        );
      })}
    </RepositoryTableShell>
  );
}

interface TableRowProps {
  'data-index': number;
  ref: React.Ref<HTMLTableRowElement>;
}

interface InstallationRowProps extends TableRowProps {
  expanded: boolean;
  installation: ScmInstallation;
  onToggle: () => void;
  providerName: string;
}

function InstallationRow({
  installation,
  expanded,
  onToggle,
  providerName,
  ...rowProps
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
    <SimpleTable.Row {...rowProps}>
      <SimpleTable.FullWidthCell>
        <InstallationToggle
          role="button"
          tabIndex={expandDisabled ? -1 : 0}
          aria-label={merged.integration.name}
          aria-expanded={expandDisabled ? undefined : expanded}
          aria-disabled={expandDisabled || undefined}
          onClick={handleRowClick}
          onKeyDown={handleRowKeyDown}
          align="center"
          justify="between"
          gap="md"
          padding="lg xl"
        >
          <Flex align="center" gap="md">
            <IconChevron direction={expanded && !expandDisabled ? 'down' : 'right'} />
            <Flex align="center" gap="sm">
              <IntegrationSummary installation={merged} />
            </Flex>
          </Flex>
          <Flex align="center" gap="md">
            <Flex align="center" display={{zero: 'none', xl: 'flex'}}>
              <InstallationRepoCountTag installation={merged} />
            </Flex>
            <InstallationActions installation={merged} providerName={providerName} />
          </Flex>
        </InstallationToggle>
      </SimpleTable.FullWidthCell>
    </SimpleTable.Row>
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
    <Tooltip title={getRepoCountTooltip(installation, lastSync)} skipWrapper>
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
  return tct('Repositories not yet synced. [syncNow]', {
    syncNow: syncNowButton,
  });
}

function InstallationActions({installation, providerName}: InstallationActionsProps) {
  const {
    manageUrl,
    overflowMenuItems,
    settingsButtonProps,
    uninstallButtonProps,
    onSettings,
    onUninstall,
  } = installation;
  const showManageRepositoriesLabel = useResponsivePropValue({
    zero: false,
    '2xl': true,
  });
  const manageRepositoriesLabel = t('Manage repositories');

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
          aria-label={manageRepositoriesLabel}
        >
          {showManageRepositoriesLabel ? manageRepositoriesLabel : undefined}
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
              strategy="fixed"
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
  onProjectClick,
}: {
  mappingsLoading: boolean | undefined;
  slugs: string[];
  action?: React.ReactNode;
  onProjectClick?: (project: AvatarProject) => void;
}) {
  return (
    <Flex align="center" gap="2xs">
      {slugs.length > 0 && (
        <ProjectList
          projectSlugs={slugs}
          maxVisibleProjects={3}
          onProjectClick={onProjectClick}
        />
      )}
      {mappingsLoading && slugs.length === 0 && (
        <Placeholder width="60px" height="16px" />
      )}
      {action}
    </Flex>
  );
}

interface RepoRowProps extends TableRowProps {
  installation: ScmInstallation;
  providerName: string;
  repo: Repository;
  repoMatches: ScmRepoMatches | undefined;
  nested?: boolean;
}

function RepoRow({
  installation,
  nested,
  providerName,
  repo,
  repoMatches,
  ...rowProps
}: RepoRowProps) {
  const merged = useMergedInstallation(installation);
  const {mappedProjectSlugsByRepoId, mappingsLoading, onMappedProjectClick} = merged;
  const nameMatch = repoMatches?.[repo.id]?.find(m => m.key === 'name');

  return (
    <RevealOnHover>
      {revealOnHoverProps => (
        <SimpleTable.Row {...rowProps} {...revealOnHoverProps}>
          <SimpleTable.RowCell gap="sm" paddingLeft={nested ? '3xl' : undefined}>
            <Text wordBreak="break-word">
              {nameMatch ? highlightFuseMatches(nameMatch, HighlightMark) : repo.name}
            </Text>
            <RevealOnHover.Action>
              <LinkButton
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
            </RevealOnHover.Action>
          </SimpleTable.RowCell>
          <SimpleTable.RowCell justify="end">
            {mappedProjectSlugsByRepoId && (
              <RepoMappings
                slugs={mappedProjectSlugsByRepoId[repo.id] ?? []}
                mappingsLoading={mappingsLoading}
                action={merged.repoActions?.(repo)}
                onProjectClick={
                  onMappedProjectClick
                    ? project => onMappedProjectClick(repo, project)
                    : undefined
                }
              />
            )}
          </SimpleTable.RowCell>
        </SimpleTable.Row>
      )}
    </RevealOnHover>
  );
}

interface EmptyRowProps extends TableRowProps {
  installation: ScmInstallation;
  repoMatches: ScmRepoMatches | undefined;
}

function EmptyRow({installation, repoMatches, ...rowProps}: EmptyRowProps) {
  const merged = useMergedInstallation(installation);

  return (
    <SimpleTable.Row {...rowProps}>
      <SimpleTable.RowCell column="1 / -1" justify="center">
        <EmptyRepositoryMessage
          isLoading={merged.reposLoading}
          manageUrl={merged.manageUrl}
          repositories={merged.repositories}
          repoMatches={repoMatches}
        />
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

const ProviderHeaderCell = styled(Table.HeadCell)`
  grid-column: 1 / -1;
  align-items: center;
  justify-content: space-between;
  gap: ${p => p.theme.space.sm};
  padding: 0 ${p => p.theme.space.xl};
  font-weight: ${p => p.theme.font.weight.sans.regular};
`;

const InstallationToggle = styled(Flex)`
  cursor: pointer;

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

const HighlightMark = styled('mark')`
  background-color: ${p => p.theme.tokens.background.transparent.warning.muted};
  color: inherit;
  border-radius: ${p => p.theme.radius.xs};
`;
