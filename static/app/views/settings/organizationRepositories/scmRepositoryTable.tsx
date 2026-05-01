import {Fragment, useEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex, Grid} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {CircleIndicator} from 'sentry/components/circleIndicator';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {Panel} from 'sentry/components/panels/panel';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {getRepoStatusLabel} from 'sentry/components/repositories/getRepoStatusLabel';
import {TimeSince} from 'sentry/components/timeSince';
import {
  IconChevron,
  IconDelete,
  IconEllipsis,
  IconOpen,
  IconSettings,
  IconSync,
} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import type {
  Integration,
  IntegrationProvider,
  Repository,
} from 'sentry/types/integrations';
import {RepositoryStatus} from 'sentry/types/integrations';
import type {Fuse} from 'sentry/utils/fuzzySearch';
import {highlightFuseMatches} from 'sentry/utils/highlightFuseMatches';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {unreachable} from 'sentry/utils/unreachable';
import {IntegrationIcon} from 'sentry/views/settings/organizationIntegrations/integrationIcon';

/**
 * Fuse match results keyed by `repository.id`, used to highlight the matched
 * portions of repository names in the table.
 */
export type ScmRepoMatches = Record<string, readonly Fuse.FuseResultMatch[]>;

export interface ScmInstallation {
  integration: Integration;
  repositories: Repository[];
  expandDisabled?: boolean;
  initiallyExpanded?: boolean;
  isLoading?: boolean;
  manageUrl?: string;
}

interface ScmRepositoryTableProps {
  installations: ScmInstallation[];
  provider: IntegrationProvider;
  lastSyncedAt?: Date;
  onDelete?: (integration: Integration) => void;
  onSync?: () => void;
  overflowMenuItems?: MenuItemProps[];
  repoMatches?: ScmRepoMatches;
  settingsTo?: string;
}

export function ScmRepositoryTable({
  provider,
  installations,
  onDelete,
  settingsTo,
  overflowMenuItems,
  lastSyncedAt,
  onSync,
  repoMatches,
}: ScmRepositoryTableProps) {
  const showFooter = lastSyncedAt !== undefined || onSync !== undefined;

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  // `initiallyExpanded` should apply the first time we see a given integration,
  // not on every render. Tracking which ids we've already considered lets late-
  // arriving installations honor the flag without resetting user toggles on a
  // refetch.
  const seenIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    setExpandedIds(prev => {
      let changed = false;
      const next = new Set(prev);
      for (const i of installations) {
        if (seenIds.current.has(i.integration.id)) {
          continue;
        }
        seenIds.current.add(i.integration.id);
        if (i.initiallyExpanded) {
          next.add(i.integration.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [installations]);

  const toggle = (id: string) =>
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  return (
    <Panel>
      <PanelHeader hasButtons>
        <Flex align="center" gap="sm">
          {getIntegrationIcon(provider.key, 'sm')}
          {provider.name}
        </Flex>
        <Flex align="center" gap="sm">
          {settingsTo && (
            <LinkButton to={settingsTo} size="xs" icon={<IconSettings />}>
              {t('Settings')}
            </LinkButton>
          )}
          {overflowMenuItems && overflowMenuItems.length > 0 && (
            <DropdownMenu
              items={overflowMenuItems}
              position="bottom-end"
              triggerProps={{
                size: 'xs',
                'aria-label': t('More actions'),
                icon: <IconEllipsis />,
              }}
            />
          )}
        </Flex>
      </PanelHeader>
      <Grid columns="max-content 1fr" gap="0 md">
        {installations.map(installation => (
          <InstallationSubgrid key={installation.integration.id}>
            <InstallationRow
              provider={provider}
              installation={installation}
              expanded={expandedIds.has(installation.integration.id)}
              onToggle={() => toggle(installation.integration.id)}
              onDelete={onDelete ? () => onDelete(installation.integration) : undefined}
              repoMatches={repoMatches}
            />
          </InstallationSubgrid>
        ))}
      </Grid>
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
  onDelete?: () => void;
  repoMatches?: ScmRepoMatches;
}

function InstallationRow({
  provider,
  installation,
  expanded,
  onToggle,
  onDelete,
  repoMatches,
}: InstallationRowProps) {
  const {integration, repositories, manageUrl, isLoading, expandDisabled} = installation;
  const isDisabled = integration.status === 'disabled';

  const handleRowClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (expandDisabled) {
      return;
    }
    if ((event.target as HTMLElement).closest('a, button')) {
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
        aria-expanded={expandDisabled ? undefined : expanded}
        aria-disabled={expandDisabled || undefined}
        onClick={handleRowClick}
        onKeyDown={handleRowKeyDown}
      >
        <IconChevron direction={expanded && !expandDisabled ? 'down' : 'right'} />
        <Flex column="2" align="center" justify="between" gap="md">
          <Flex align="center" gap="sm">
            <IntegrationIcon integration={integration} size={16} />
            <Text bold>{integration.name}</Text>
            {isDisabled ? (
              <Tag variant="warning">{t('Disabled')}</Tag>
            ) : (
              <Tag variant="muted">
                {tn('%s repo connected', '%s repos connected', repositories.length)}
              </Tag>
            )}
          </Flex>
          <Flex align="center" gap="md">
            {isLoading && (
              <Flex align="center" gap="sm">
                <StatusIndicator variant="accent" />
                <Text variant="muted" size="xs">
                  {t('Loading Repositories')}
                </Text>
              </Flex>
            )}
            {manageUrl && (
              <LinkButton
                tooltipProps={{
                  title: t('Add or remove repository access on %s', provider.name),
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
            {onDelete && (
              <Button
                aria-label={t('Uninstall')}
                size="xs"
                variant="transparent"
                icon={<IconDelete />}
                onClick={onDelete}
              />
            )}
          </Flex>
        </Flex>
      </RowButton>
      {expanded && !expandDisabled && (
        <RepoRows
          repositories={repositories}
          repoMatches={repoMatches}
          manageUrl={manageUrl}
        />
      )}
    </Fragment>
  );
}

interface RepoRowsProps {
  repositories: Repository[];
  manageUrl?: string;
  repoMatches?: ScmRepoMatches;
}

function RepoRows({repositories, repoMatches, manageUrl}: RepoRowsProps) {
  const theme = useTheme();

  const statusColor = (status: RepositoryStatus) => {
    switch (status) {
      case RepositoryStatus.DISABLED:
      case RepositoryStatus.HIDDEN:
      case RepositoryStatus.DELETION_IN_PROGRESS:
        return theme.tokens.graphics.danger.vibrant;
      case RepositoryStatus.PENDING_DELETION:
        return theme.tokens.graphics.warning.vibrant;
      case RepositoryStatus.ACTIVE:
        return theme.tokens.graphics.success.vibrant;
      default:
        return unreachable(status);
    }
  };

  const visibleRepos =
    repoMatches === undefined
      ? repositories
      : repositories.filter(r => repoMatches[r.id]);

  if (visibleRepos.length === 0) {
    const message =
      repoMatches !== undefined && repositories.length > 0
        ? t('No repositories match your search')
        : manageUrl
          ? tct('No repositories available. [link:Manage repository access]', {
              link: <ExternalLink href={manageUrl} />,
            })
          : t('No repositories available.');
    return (
      <RepoRow padding="md xl" justify="center">
        <Text variant="muted">{message}</Text>
      </RepoRow>
    );
  }

  return (
    <Fragment>
      {visibleRepos.map(repo => {
        const statusLabel = getRepoStatusLabel(repo) ?? t('Active');
        const nameMatch = repoMatches?.[repo.id]?.find(m => m.key === 'name');
        return (
          <RepoRow
            key={repo.id}
            align="center"
            justify="between"
            gap="md"
            padding="xs xl"
          >
            <Flex align="center" gap="md">
              <Tooltip title={statusLabel} skipWrapper>
                <CircleIndicator size={4} color={statusColor(repo.status)} />
              </Tooltip>
              <Text>
                {nameMatch ? highlightFuseMatches(nameMatch, HighlightMark) : repo.name}
              </Text>
            </Flex>
            <LinkButton
              href={repo.url ?? ''}
              external
              size="xs"
              variant="transparent"
              icon={<IconOpen variant="muted" />}
              aria-label={t('Open repository')}
            />
          </RepoRow>
        );
      })}
    </Fragment>
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
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};

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

  *:last-child > &:last-child {
    border-bottom-left-radius: ${p => p.theme.radius.md};
    border-bottom-right-radius: ${p => p.theme.radius.md};
  }
`;

function RepoRow({
  children,
  padding,
  ...flexProps
}: Omit<React.ComponentProps<typeof Flex>, 'children'> & {
  children?: React.ReactNode;
}) {
  return (
    <RepoRowWrapper column="1/-1" columns="subgrid" padding={padding}>
      <Flex column="2" {...flexProps}>
        {children}
      </Flex>
    </RepoRowWrapper>
  );
}

const RepoRowWrapper = styled(Grid)`
  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const HighlightMark = styled('mark')`
  background-color: ${p => p.theme.tokens.background.transparent.warning.muted};
  color: inherit;
  border-radius: ${p => p.theme.radius.xs};
`;
