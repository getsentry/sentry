import styled from '@emotion/styled';

import {UserAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {getRelativeSummary} from 'sentry/components/timeRangeSelector/utils';
import {IconGraph} from 'sentry/icons/iconGraph';
import {IconMarkdown} from 'sentry/icons/iconMarkdown';
import {IconNumber} from 'sentry/icons/iconNumber';
import {IconSettings} from 'sentry/icons/iconSettings';
import {IconTable} from 'sentry/icons/iconTable';
import {t} from 'sentry/locale';
import type {User} from 'sentry/types/user';
import {getFormattedDate} from 'sentry/utils/dates';
import {useProjects} from 'sentry/utils/useProjects';

import type {DashboardRevision} from './hooks/useDashboardRevisions';
import {useDashboardRevisionDetails} from './hooks/useDashboardRevisions';
import type {FieldChange, WidgetChange} from './dashboardRevisionsDiff';
import {diffWidgets} from './dashboardRevisionsDiff';
import type {DashboardDetails, Widget} from './types';
import {DashboardFilterKeys, DisplayType} from './types';

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

  function formatTime(d: DashboardDetails): string | null {
    if (d.period) return getRelativeSummary(d.period);
    if (d.start && d.end) {
      const fmt = (s: string) => getFormattedDate(s, 'MMM D, YYYY', {local: !d.utc});
      return `${fmt(d.start)} – ${fmt(d.end)}`;
    }
    return null;
  }

  function formatProjects(ids: number[] | undefined): string {
    if (!ids?.length) return t('My Projects');
    if (ids.includes(ALL_ACCESS_PROJECTS)) return t('All Projects');
    return ids
      .map(id => allProjects.find(p => parseInt(p.id, 10) === id)?.slug ?? String(id))
      .join(', ');
  }

  function formatList(items: string[] | undefined): string {
    const filtered = items?.filter(Boolean) ?? [];
    return filtered.length ? filtered.join(', ') : t('(none)');
  }

  const changes: Array<{after: string; before: string; label: string}> = [];

  if (base.title !== snapshot.title) {
    changes.push({label: t('Title'), before: base.title, after: snapshot.title});
  }

  const baseTime = formatTime(base);
  const snapshotTime = formatTime(snapshot);
  if (baseTime !== snapshotTime) {
    changes.push({
      label: t('Time range'),
      before: baseTime ?? t('(default)'),
      after: snapshotTime ?? t('(default)'),
    });
  }

  const baseProjects = formatProjects(base.projects);
  const snapshotProjects = formatProjects(snapshot.projects);
  if (baseProjects !== snapshotProjects) {
    changes.push({
      label: t('Projects'),
      before: baseProjects,
      after: snapshotProjects,
    });
  }

  const baseEnv = formatList(base.environment);
  const snapshotEnv = formatList(snapshot.environment);
  if (baseEnv !== snapshotEnv) {
    changes.push({label: t('Environment'), before: baseEnv, after: snapshotEnv});
  }

  const baseReleases = formatList(base.filters?.[DashboardFilterKeys.RELEASE]);
  const snapshotReleases = formatList(snapshot.filters?.[DashboardFilterKeys.RELEASE]);
  if (baseReleases !== snapshotReleases) {
    changes.push({
      label: t('Releases'),
      before: baseReleases,
      after: snapshotReleases,
    });
  }

  const baseGlobal =
    (base.filters?.[DashboardFilterKeys.GLOBAL_FILTER] ?? [])
      .map(f => f.value)
      .join(', ') || t('(none)');
  const snapshotGlobal =
    (snapshot.filters?.[DashboardFilterKeys.GLOBAL_FILTER] ?? [])
      .map(f => f.value)
      .join(', ') || t('(none)');
  if (baseGlobal !== snapshotGlobal) {
    changes.push({
      label: t('Global filters'),
      before: baseGlobal,
      after: snapshotGlobal,
    });
  }

  if (!changes.length) {
    return null;
  }

  return (
    <Flex direction="column" gap="xs">
      {changes.map(({label, before, after}) => (
        <FieldChangeRow key={label}>
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
        </FieldChangeRow>
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
    <WidgetCard>
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
        <FieldChangeRow key={field}>
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
        </FieldChangeRow>
      ))}
      {layoutChanged && (
        <Text size="sm" variant="muted">
          {t('Layout position or size changed')}
        </Text>
      )}
    </WidgetCard>
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

const WidgetCard = styled('div')`
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: ${p => p.theme.radius.sm};
  padding: ${p => p.theme.space.md};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.sm};
`;

const FieldChangeRow = styled('div')`
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: ${p => p.theme.space.sm};
  align-items: baseline;
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
