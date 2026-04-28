import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {UserAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconGraph} from 'sentry/icons/iconGraph';
import {t} from 'sentry/locale';
import type {User} from 'sentry/types/user';
import {useProjects} from 'sentry/utils/useProjects';

import type {DashboardRevision} from './hooks/useDashboardRevisions';
import {useDashboardRevisionDetails} from './hooks/useDashboardRevisions';
import {typeIcons} from './widgetBuilder/components/typeSelector';
import type {WidgetChange} from './dashboardRevisionsDiff';
import {diffFilters, diffWidgets, formatProjectIds} from './dashboardRevisionsDiff';
import type {DashboardDetails} from './types';

interface RevisionListItemProps {
  baseRevisionId: string | null;
  createdBy: {email: string; id: string; name: string} | null;
  dashboardId: string;
  dateCreated: string | null;
  isSelected: boolean;
  onSelect: () => void;
  revisionSource: DashboardRevision['source'];
  baseSnapshotOverride?: DashboardDetails;
  isCurrentVersion?: boolean;
  revisionId?: string;
  snapshotOverride?: DashboardDetails;
}

function formatRevisionSource(source: DashboardRevision['source']): string {
  if (source === 'pre-restore') return t('Revert Dashboard');
  if (source === 'edit-with-agent') return t('Edit with Seer');
  return t('Edit');
}

const EMPTY_SNAPSHOT: DashboardDetails = {
  id: '',
  title: '',
  dateCreated: '',
  widgets: [],
  filters: {},
  projects: undefined,
};

export function RevisionListItem({
  isCurrentVersion,
  isSelected,
  onSelect,
  revisionSource,
  createdBy,
  dateCreated,
  dashboardId,
  baseRevisionId,
  revisionId,
  snapshotOverride,
  baseSnapshotOverride,
}: RevisionListItemProps) {
  const {
    data: fetchedSnapshot,
    isPending: isSnapshotPending,
    isError: isSnapshotError,
  } = useDashboardRevisionDetails({
    dashboardId,
    revisionId: snapshotOverride ? null : (revisionId ?? null),
  });

  const {
    data: fetchedBaseSnapshot,
    isPending: isBasePending,
    isError: isBaseFetchError,
  } = useDashboardRevisionDetails({
    dashboardId,
    revisionId: baseSnapshotOverride ? null : baseRevisionId,
  });

  const snapshot = snapshotOverride ?? fetchedSnapshot;
  const baseSnapshot = baseSnapshotOverride ?? fetchedBaseSnapshot;
  const isSnapshotLoading = !snapshotOverride && isSnapshotPending;
  const isBaseLoading = !baseSnapshotOverride && baseRevisionId !== null && isBasePending;
  const isAnyLoading = isSnapshotLoading || isBaseLoading;
  const isBaseError =
    !baseSnapshotOverride && baseRevisionId !== null && isBaseFetchError;

  const userForAvatar = createdBy
    ? ({
        id: createdBy.id,
        name: createdBy.name,
        email: createdBy.email,
        ip_address: '',
        username: createdBy.email,
      } as User)
    : null;

  return (
    <RevisionItem $isSelected={isSelected} onClick={onSelect}>
      <Flex align="start" gap="md">
        <RadioInput
          type="radio"
          name="revision-selection"
          checked={isSelected}
          onChange={onSelect}
          onClick={e => e.stopPropagation()}
          aria-label={
            isCurrentVersion
              ? t('Select Current Version')
              : formatRevisionSource(revisionSource)
          }
        />
        <Flex direction="column" gap="md" style={{flex: 1, minWidth: 0}}>
          <Flex direction="column" gap="xs">
            {isCurrentVersion ? (
              <Text bold size="sm" variant="accent">
                {t('Current Version')}
              </Text>
            ) : (
              <Text bold size="sm">
                {formatRevisionSource(revisionSource)}
              </Text>
            )}
            {dateCreated && <DateTime date={dateCreated} timeZone />}
            <Flex align="center" gap="xs">
              {userForAvatar && <UserAvatar user={userForAvatar} size={16} />}
              <Text size="sm" variant="muted">
                {createdBy ? createdBy.name || createdBy.email : t('Unknown')}
              </Text>
            </Flex>
          </Flex>

          {isAnyLoading ? (
            <LoadingIndicator />
          ) : (!snapshotOverride && isSnapshotError) || isBaseError ? (
            <Text size="sm" variant="muted">
              {t('Failed to load revision preview.')}
            </Text>
          ) : snapshot && baseRevisionId === null ? (
            <Text size="sm" variant="muted">
              {t('This is the oldest revision — no previous state to compare against.')}
            </Text>
          ) : snapshot ? (
            <Flex direction="column" gap="xl">
              <FilterDiffSection
                base={baseSnapshot ?? EMPTY_SNAPSHOT}
                snapshot={snapshot}
              />
              <WidgetDiffSection
                widgetChanges={diffWidgets(baseSnapshot ?? EMPTY_SNAPSHOT, snapshot)}
              />
            </Flex>
          ) : null}
        </Flex>
      </Flex>
    </RevisionItem>
  );
}

function FilterDiffSection({
  base,
  snapshot,
}: {
  base: DashboardDetails;
  snapshot: DashboardDetails;
}) {
  const {projects: allProjects} = useProjects();

  const resolveProjectIds = (ids: number[] | undefined) =>
    formatProjectIds(ids, id => allProjects.find(p => parseInt(p.id, 10) === id)?.slug);

  const changes = diffFilters(base, snapshot, resolveProjectIds);

  if (!changes.length) {
    return null;
  }

  return (
    <Flex direction="column" gap="xs">
      {changes.map(({label, before, after}) => (
        <Grid key={label} columns="90px 1fr" gap="sm" align="baseline">
          <Text size="sm" variant="muted">
            {label}
          </Text>
          <Flex align="center" gap="xs" wrap="wrap">
            <Text
              as="span"
              size="sm"
              variant="danger"
              strikethrough
              monospace
              wordBreak="break-all"
            >
              {before}
            </Text>
            <Text size="sm" variant="muted">
              {'→'}
            </Text>
            <Text as="span" size="sm" variant="success" monospace wordBreak="break-all">
              {after}
            </Text>
          </Flex>
        </Grid>
      ))}
    </Flex>
  );
}

function WidgetDiffSection({widgetChanges}: {widgetChanges: WidgetChange[]}) {
  return (
    <Flex direction="column" gap="xs">
      {widgetChanges.length === 0 && (
        <Text size="sm" variant="muted">
          {t('No widget changes in this revision.')}
        </Text>
      )}
      {widgetChanges.map((change, i) => (
        <WidgetDiffCard key={i} change={change} />
      ))}
    </Flex>
  );
}

function WidgetDiffCard({change}: {change: WidgetChange}) {
  const theme = useTheme();
  const {status, widget} = change;
  const fields = status === 'modified' ? change.fields : undefined;
  const layoutChanged = status === 'modified' ? change.layoutChanged : false;

  let statusLabel: string;
  if (status === 'added') statusLabel = t('Added');
  else if (status === 'removed') statusLabel = t('Removed');
  else statusLabel = t('Modified');

  let tagVariant: 'success' | 'danger' | 'warning';
  if (status === 'added') tagVariant = 'success';
  else if (status === 'removed') tagVariant = 'danger';
  else tagVariant = 'warning';

  return (
    <Flex direction="column" gap="sm" border="secondary" radius="sm" padding="md">
      <Flex align="center" justify="between" gap="sm">
        <Flex align="center" gap="xs" style={{minWidth: 0}}>
          <Flex
            align="center"
            flexShrink={0}
            style={{color: theme.tokens.content.secondary}}
          >
            {typeIcons[widget.displayType] ?? <IconGraph />}
          </Flex>
          <Text
            bold
            size="sm"
            style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}
          >
            {widget.title || t('(untitled)')}
          </Text>
        </Flex>
        <Tag variant={tagVariant}>{statusLabel}</Tag>
      </Flex>
      {fields?.map(({field, before, after}) => (
        <Grid key={field} columns="90px 1fr" gap="sm" align="baseline">
          <Text size="sm" variant="muted">
            {field}
          </Text>
          <Flex align="center" gap="xs" wrap="wrap">
            <Text
              as="span"
              size="sm"
              variant="danger"
              strikethrough
              monospace
              wordBreak="break-all"
            >
              {before}
            </Text>
            <Text size="sm" variant="muted">
              {'→'}
            </Text>
            <Text as="span" size="sm" variant="success" monospace wordBreak="break-all">
              {after}
            </Text>
          </Flex>
        </Grid>
      ))}
      {layoutChanged && (
        <Text size="sm" variant="muted">
          {t('Layout position or size changed')}
        </Text>
      )}
    </Flex>
  );
}

const RevisionItem = styled('div')<{$isSelected: boolean}>`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.md};
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  cursor: pointer;
  transition: background 100ms ease;
  background: ${p =>
    p.$isSelected
      ? p.theme.tokens.interactive.transparent.accent.selected.background.rest
      : 'transparent'};

  &:hover {
    background: ${p =>
      p.$isSelected
        ? p.theme.tokens.interactive.transparent.accent.selected.background.hover
        : p.theme.tokens.background.secondary};
  }

  &:last-child {
    border-bottom: none;
  }
`;

const RadioInput = styled('input')`
  flex-shrink: 0;
  margin-top: 2px;
  cursor: pointer;
  accent-color: ${p => p.theme.tokens.graphics.accent.vibrant};
`;
