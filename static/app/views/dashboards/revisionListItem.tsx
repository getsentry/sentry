import styled from '@emotion/styled';

import {UserAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconGraph} from 'sentry/icons/iconGraph';
import {IconMarkdown} from 'sentry/icons/iconMarkdown';
import {IconNumber} from 'sentry/icons/iconNumber';
import {IconSettings} from 'sentry/icons/iconSettings';
import {IconTable} from 'sentry/icons/iconTable';
import {t} from 'sentry/locale';
import type {User} from 'sentry/types/user';
import {useProjects} from 'sentry/utils/useProjects';

import type {DashboardRevision} from './hooks/useDashboardRevisions';
import {useDashboardRevisionDetails} from './hooks/useDashboardRevisions';
import type {FieldChange, WidgetChange} from './dashboardRevisionsDiff';
import {diffFilters, diffWidgets, formatProjectIds} from './dashboardRevisionsDiff';
import type {DashboardDetails, Widget} from './types';
import {DisplayType} from './types';

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

  const {data: fetchedBaseSnapshot, isPending: isBasePending} =
    useDashboardRevisionDetails({
      dashboardId,
      revisionId: baseSnapshotOverride ? null : baseRevisionId,
    });

  const snapshot = snapshotOverride ?? fetchedSnapshot;
  const baseSnapshot = baseSnapshotOverride ?? fetchedBaseSnapshot;
  const isSnapshotLoading = !snapshotOverride && isSnapshotPending;
  const isBaseLoading = !baseSnapshotOverride && baseRevisionId !== null && isBasePending;
  const isAnyLoading = isSnapshotLoading || isBaseLoading;

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
          ) : !snapshotOverride && isSnapshotError ? (
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
            <DiffBefore>{before}</DiffBefore>
            <Text size="sm" variant="muted">
              {'→'}
            </Text>
            <DiffAfter>{after}</DiffAfter>
          </Flex>
        </Grid>
      ))}
    </Flex>
  );
}

function WidgetDiffSection({widgetChanges}: {widgetChanges: WidgetChange[]}) {
  const meaningful = widgetChanges.filter(c => c.status !== 'unchanged');

  return (
    <Flex direction="column" gap="xs">
      {meaningful.length === 0 && (
        <Text size="sm" variant="muted">
          {t('No widget changes in this revision.')}
        </Text>
      )}
      {meaningful.map((change, i) => {
        if (change.status === 'added') {
          return <WidgetDiffCard key={i} status="added" widget={change.widget} />;
        }
        if (change.status === 'removed') {
          return <WidgetDiffCard key={i} status="removed" widget={change.widget} />;
        }
        if (change.status === 'modified') {
          return (
            <WidgetDiffCard
              key={i}
              status="modified"
              widget={change.widget}
              fields={change.fields}
              layoutChanged={change.layoutChanged}
            />
          );
        }
        return null;
      })}
    </Flex>
  );
}

function WidgetDiffCard({
  status,
  widget,
  fields,
  layoutChanged,
}: {
  status: 'added' | 'removed' | 'modified';
  widget: Widget;
  fields?: FieldChange[];
  layoutChanged?: boolean;
}) {
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
          <WidgetTileIcon>
            {DISPLAY_TYPE_ICONS[widget.displayType] ?? <IconGraph size="sm" />}
          </WidgetTileIcon>
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
            <DiffBefore>{before}</DiffBefore>
            <Text size="sm" variant="muted">
              {'→'}
            </Text>
            <DiffAfter>{after}</DiffAfter>
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

const DISPLAY_TYPE_ICONS: Partial<Record<DisplayType, React.ReactNode>> = {
  [DisplayType.AREA]: <IconGraph type="area" size="sm" />,
  [DisplayType.BAR]: <IconGraph type="bar" size="sm" />,
  [DisplayType.LINE]: <IconGraph type="line" size="sm" />,
  [DisplayType.TABLE]: <IconTable size="sm" />,
  [DisplayType.BIG_NUMBER]: <IconNumber size="sm" />,
  [DisplayType.CATEGORICAL_BAR]: <IconGraph type="bar" size="sm" />,
  [DisplayType.TEXT]: <IconMarkdown size="sm" />,
  [DisplayType.DETAILS]: <IconSettings size="sm" />,
};

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

const WidgetTileIcon = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
  flex-shrink: 0;
`;

const DiffBefore = styled('span')`
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.danger};
  text-decoration: line-through;
  font-family: ${p => p.theme.font.family.mono};
  word-break: break-all;
`;

const DiffAfter = styled('span')`
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.success};
  font-family: ${p => p.theme.font.family.mono};
  word-break: break-all;
`;
