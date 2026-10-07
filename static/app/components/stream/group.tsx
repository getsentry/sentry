import {Fragment, useCallback, useMemo, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Container, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import type {AssignableEntity} from 'sentry/components/assigneeSelectorDropdown';
import {GuideAnchor} from 'sentry/components/assistant/guideAnchor';
import {GroupStatusChart} from 'sentry/components/charts/groupStatusChart';
import {Count} from 'sentry/components/count';
import {AssigneeAvatar} from 'sentry/components/group/assigneeAvatar';
import {AssigneeSelector} from 'sentry/components/group/assigneeSelector';
import {getBadgeProperties} from 'sentry/components/group/inboxBadges/statusBadge';
import {GroupHeaderRow} from 'sentry/components/groupHeaderRow';
import {GroupMetaRow} from 'sentry/components/groupMetaRow';
import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Placeholder} from 'sentry/components/placeholder';
import {ProgressBar} from 'sentry/components/progressBar';
import {joinQuery, parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import {
  StreamGroupCell,
  useStreamGroupColumns,
  type StreamGroupColumn,
} from 'sentry/components/stream/groupColumns';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {getRelativeSummary} from 'sentry/components/timeRangeSelector/utils';
import {TimeSince} from 'sentry/components/timeSince';
import {UnreadIndicator} from 'sentry/components/unreadIndicator';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {TimeseriesValue} from 'sentry/types/core';
import type {
  Group,
  GroupReprocessing,
  InboxDetails,
  PriorityLevel,
} from 'sentry/types/group';
import type {NewQuery} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {percent} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {defined} from 'sentry/utils/defined';
import {EventView} from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {isCtrlKeyPressed} from 'sentry/utils/isCtrlKeyPressed';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {ListItemCheckbox} from 'sentry/utils/list/listItemSelectCheckbox';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {GroupPriority} from 'sentry/views/issueDetails/groupPriority';
import {useAssignIssueMutation} from 'sentry/views/issueDetails/useAssignIssueMutation';
import {
  useOptionalIssueSelectionActions,
  useOptionalIssueSelectionSummary,
} from 'sentry/views/issueList/issueSelectionContext';
import {
  createIssueLink,
  DISCOVER_EXCLUSION_FIELDS,
  isForReviewQuery,
} from 'sentry/views/issueList/utils';

export const DEFAULT_STREAM_GROUP_STATS_PERIOD = '24h';
const COLUMNS: GroupListColumn[] = ['graph', 'event', 'users', 'priority', 'assignee'];

type Props = {
  group: Group;
  canSelect?: boolean;
  displayReprocessingLayout?: boolean;
  hasGuideAnchor?: boolean;
  memberList?: User[];
  onAssigneeChange?: (newAssignee: AssignableEntity | null) => void;
  onPriorityChange?: (newPriority: PriorityLevel) => void;
  query?: string;
  queryFilterDescription?: string;
  source?: string;
  statsPeriod?: string;
  useFilteredStats?: boolean;
  useTintRow?: boolean;
  withChart?: boolean;
  withColumns?: GroupListColumn[];
};

function GroupCheckbox({
  group,
  displayReprocessingLayout,
}: {
  group: Group;
  displayReprocessingLayout?: boolean;
}) {
  const issueSelectionSummary = useOptionalIssueSelectionSummary();
  const issueSelectionActions = useOptionalIssueSelectionActions();
  const isSelected = issueSelectionSummary?.records.get(group.id);

  const handleToggle = useCallback(
    (isShiftClick: boolean) => {
      if (isShiftClick) {
        issueSelectionActions?.shiftToggleSelect(group.id);
      } else {
        issueSelectionActions?.toggleSelect(group.id);
      }
    },
    [group.id, issueSelectionActions]
  );

  const onChange = useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      const mouseEvent = evt.nativeEvent as MouseEvent;
      handleToggle(mouseEvent.shiftKey);
    },
    [handleToggle]
  );

  return (
    <GroupCheckBoxWrapper>
      <CheckboxLabel>
        <ListItemCheckbox
          id={group.id}
          aria-label={t('Select Issue')}
          checked={isSelected}
          disabled={!!displayReprocessingLayout}
          onChange={onChange}
        />
        {!group.hasSeen && <UnreadIndicator data-test-id="unread-issue-indicator" />}
      </CheckboxLabel>
    </GroupCheckBoxWrapper>
  );
}

function GroupLastSeen({group}: {group: Group}) {
  if (!group.lifetime) {
    return <Placeholder height="18px" width="70px" />;
  }

  if (!group.lifetime.lastSeen) {
    return null;
  }

  return (
    <PositionedTimeSince
      date={group.lifetime.lastSeen}
      suffix="ago"
      unitStyle="short"
      aria-label={t('Last Seen')}
      tooltipPrefix={t('Last Seen')}
    />
  );
}

function GroupFirstSeen({group}: {group: Group}) {
  if (!group.lifetime) {
    return <Placeholder height="18px" width="30px" />;
  }

  if (!group.lifetime.firstSeen) {
    return null;
  }

  return (
    <PositionedTimeSince
      date={group.lifetime.firstSeen}
      unitStyle="short"
      suffix=""
      aria-label={t('First Seen')}
      tooltipPrefix={t('First Seen')}
    />
  );
}

type LoadingSteamGroupProps = Pick<
  Props,
  'canSelect' | 'displayReprocessingLayout' | 'withChart' | 'withColumns'
>;

export function LoadingStreamGroup({
  canSelect = true,
  displayReprocessingLayout = false,
  withChart = true,
  withColumns = COLUMNS,
}: LoadingSteamGroupProps) {
  const {columns, selectionEnabled} = useStreamGroupColumns({
    canSelect,
    displayReprocessingLayout,
    withChart,
    withColumns,
  });

  return (
    <StreamGroupRow data-test-id="group" useTintRow={false} reviewed={false}>
      {columns.map(column => (
        <StreamGroupCell
          key={column.key}
          column={column}
          selectionEnabled={selectionEnabled}
        >
          {column.key === 'select' ? null : (
            <Placeholder {...LOADING_PLACEHOLDER_PROPS[column.key]} />
          )}
        </StreamGroupCell>
      ))}
    </StreamGroupRow>
  );
}

const LOADING_PLACEHOLDER_PROPS: Record<
  Exclude<StreamGroupColumn['key'], 'select'>,
  {height: string; width?: string}
> = {
  issue: {height: '58px'},
  lastSeen: {height: '18px', width: '70px'},
  firstSeen: {height: '18px', width: '30px'},
  graph: {height: '36px'},
  reprocessingStarted: {height: '17px'},
  reprocessingEvents: {height: '17px'},
  reprocessingProgress: {height: '17px'},
  event: {height: '18px', width: '40px'},
  users: {height: '18px', width: '40px'},
  priority: {height: '24px'},
  assignee: {height: '24px'},
};

function ReprocessingCell({
  column,
  group,
}: {
  column: StreamGroupColumn;
  group: GroupReprocessing;
}) {
  const {statusDetails, count} = group;
  const {info, pendingEvents} = statusDetails;

  if (!info) {
    return null;
  }

  const {totalEvents, dateCreated} = info;

  const remainingEventsToReprocess = totalEvents - pendingEvents;

  switch (column.key) {
    case 'reprocessingStarted':
      return (
        <Text ellipsis>
          <TimeSince date={dateCreated} />
        </Text>
      );
    case 'reprocessingEvents':
      return defined(count) ? (
        <Text ellipsis>
          <Count value={remainingEventsToReprocess} />
          {'/'}
          <Count value={totalEvents} />
        </Text>
      ) : (
        <Placeholder height="17px" />
      );
    case 'reprocessingProgress':
      return <ProgressBar value={percent(remainingEventsToReprocess, totalEvents)} />;
    default:
      return null;
  }
}

export function StreamGroup({
  group,
  displayReprocessingLayout,
  hasGuideAnchor,
  memberList,
  query,
  queryFilterDescription,
  source,
  statsPeriod = DEFAULT_STREAM_GROUP_STATS_PERIOD,
  canSelect = true,
  withChart = true,
  withColumns = COLUMNS,
  useFilteredStats = false,
  useTintRow = true,
  onPriorityChange,
  onAssigneeChange,
}: Props) {
  const issueSelectionActions = useOptionalIssueSelectionActions();
  const groupId = group.id;

  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const area = useAnalyticsArea();
  const {columns, selectionEnabled} = useStreamGroupColumns({
    canSelect,
    displayReprocessingLayout: !!displayReprocessingLayout,
    withChart,
    withColumns,
  });
  const originalInboxState = useRef(group.inbox as InboxDetails | null);
  const {selection} = usePageFilters();

  const referrer = source ? `${source}-issue-stream` : 'issue-stream';

  const {period, start, end} = selection.datetime || {};

  const summary =
    !!start && !!end
      ? 'time range'
      : getRelativeSummary(period || DEFAULT_STATS_PERIOD).toLowerCase();

  const sharedAnalytics = useMemo(() => {
    const owners = group?.owners ?? [];
    return {
      organization,
      group_id: group?.id ?? '',
      was_shown_suggestion: owners.length > 0,
    };
  }, [organization, group]);

  const {mutate: assignMutate, isPending: assigneeLoading} = useAssignIssueMutation();

  const handleAssigneeChange = useCallback(
    (newAssignee: AssignableEntity | null) => {
      assignMutate(
        {
          groupId,
          orgSlug: organization.slug,
          actor: newAssignee ? {id: newAssignee.id, type: newAssignee.type} : null,
          assignedBy: 'assignee_selector',
        },
        {
          onSuccess: () => {
            if (query !== undefined && newAssignee) {
              trackAnalytics('issues_stream.issue_assigned', {
                ...sharedAnalytics,
                did_assign_suggestion: !!newAssignee.suggestedAssignee,
                assigned_suggestion_reason:
                  newAssignee.suggestedAssignee?.suggestedReason,
                assigned_type: newAssignee.type,
                area,
              });
            }
            onAssigneeChange?.(newAssignee);
          },
        }
      );
    },
    [
      area,
      assignMutate,
      groupId,
      onAssigneeChange,
      organization.slug,
      query,
      sharedAnalytics,
    ]
  );

  const clickHasBeenHandled = useCallback((evt: React.MouseEvent<HTMLElement>) => {
    const targetElement = evt.target as Partial<HTMLElement>;
    const tagName = targetElement?.tagName?.toLowerCase();

    const ignoredTags = new Set(['a', 'input', 'label']);

    if (tagName && ignoredTags.has(tagName)) {
      return true;
    }

    let e = targetElement;
    while (e.parentElement) {
      if (ignoredTags.has(e?.tagName?.toLowerCase() ?? '')) {
        return true;
      }
      e = e.parentElement!;
    }

    return false;
  }, []);

  const groupStats = useMemo<readonly TimeseriesValue[]>(() => {
    return group.filtered
      ? group.filtered.stats?.[statsPeriod]!
      : group.stats?.[statsPeriod]!;
  }, [group, statsPeriod]);

  const groupSecondaryStats = useMemo<readonly TimeseriesValue[]>(() => {
    return group.filtered ? group.stats?.[statsPeriod]! : [];
  }, [group, statsPeriod]);

  const parsedSearch = useMemo(() => parseSearch(query ?? ''), [query]);

  const getDiscoverUrl = (isFiltered?: boolean): LocationDescriptor => {
    // When there is no Discover feature, open the events page.
    const hasDiscoverQuery = organization.features.includes('discover-basic');

    const filteredTerms = isFiltered
      ? parsedSearch?.filter(
          p =>
            !(p.type === Token.FILTER && DISCOVER_EXCLUSION_FIELDS.includes(p.key.text))
        )
      : [];
    const filteredQuery = joinQuery(filteredTerms, true);
    const commonQuery = {projects: [Number(group.project.id)]};

    if (hasDiscoverQuery) {
      const stats = selection.datetime || {};
      const discoverQuery: NewQuery = {
        ...commonQuery,
        id: undefined,
        name: group.title || group.type,
        fields: ['title', 'release', 'environment', 'user', 'timestamp'],
        orderby: '-timestamp',
        query: `issue:${group.shortId}${filteredQuery}`,
        version: 2,
      };

      if (!!stats.start && !!stats.end) {
        discoverQuery.start = new Date(stats.start).toISOString();
        discoverQuery.end = new Date(stats.end).toISOString();
        if (stats.utc) {
          discoverQuery.utc = true;
        }
      } else {
        discoverQuery.range = stats.period || DEFAULT_STATS_PERIOD;
      }

      const discoverView = EventView.fromSavedQuery(discoverQuery);
      return discoverView.getResultsViewUrlTarget(
        organization,
        false,
        hasDatasetSelector(organization) ? SavedQueryDatasets.ERRORS : undefined
      );
    }

    return {
      pathname: `/organizations/${organization.slug}/issues/${group.id}/events/`,
      query: {
        referrer,
        ...commonQuery,
        query: filteredQuery,
      },
    };
  };

  const issueTypeConfig = getConfigForIssueType(group, group.project);
  const reviewed =
    // Original state had an inbox reason
    // oxlint-disable-next-line react/refs
    originalInboxState.current?.reason !== undefined &&
    // Updated state has been removed from inbox
    !group.inbox &&
    // Only apply reviewed on the "for review" tab
    isForReviewQuery(query);

  // Use data.filtered to decide on which value to use
  // In case of the query has filters but we avoid showing both sets of filtered/unfiltered stats
  // we use useFilteredStats param passed to Group for deciding
  const primaryCount = group.filtered ? group.filtered.count : group.count;
  const secondaryCount = group.filtered ? group.count : undefined;
  const primaryUserCount = group.filtered ? group.filtered.userCount : group.userCount;
  const secondaryUserCount = group.filtered ? group.userCount : undefined;
  // preview stats
  const showSecondaryPoints = Boolean(
    withChart && group?.filtered && statsPeriod && useFilteredStats
  );

  const groupCount = (
    <Tooltip
      disabled={!useFilteredStats}
      title={
        <CountTooltipContent>
          <h4>{issueTypeConfig.customCopy.eventUnits}</h4>
          {group.filtered && (
            <Fragment>
              <div>{queryFilterDescription ?? t('Matching filters')}</div>
              <Link to={getDiscoverUrl(true)}>
                <Count value={group.filtered?.count} />
              </Link>
            </Fragment>
          )}
          <Fragment>
            <div>{t('Total in %s', summary)}</div>
            <Link to={getDiscoverUrl()}>
              <Count value={group.count} />
            </Link>
          </Fragment>
          {group.lifetime && (
            <Fragment>
              <div>{t('Since issue began')}</div>
              <Count value={group.lifetime.count} />
            </Fragment>
          )}
        </CountTooltipContent>
      }
    >
      <Stack position="relative">
        <PrimaryCount value={primaryCount} />
        {secondaryCount !== undefined && useFilteredStats && (
          <SecondaryCount value={secondaryCount} />
        )}
      </Stack>
    </Tooltip>
  );

  const groupUsersCount = (
    <Tooltip
      title={
        <CountTooltipContent>
          <h4>{t('Affected Users')}</h4>
          {group.filtered && (
            <Fragment>
              <div>{queryFilterDescription ?? t('Matching filters')}</div>
              <Link to={getDiscoverUrl(true)}>
                <Count value={group.filtered?.userCount} />
              </Link>
            </Fragment>
          )}
          <Fragment>
            <div>{t('Total in %s', summary)}</div>
            <Link to={getDiscoverUrl()}>
              <Count value={group.userCount} />
            </Link>
          </Fragment>
          {group.lifetime && (
            <Fragment>
              <div>{t('Since issue began')}</div>
              <Count value={group.lifetime.userCount} />
            </Fragment>
          )}
        </CountTooltipContent>
      }
    >
      <Stack position="relative">
        <PrimaryCount value={primaryUserCount} />
        {secondaryUserCount !== undefined && useFilteredStats && (
          <SecondaryCount value={secondaryUserCount} />
        )}
      </Stack>
    </Tooltip>
  );

  const onClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    if (displayReprocessingLayout) {
      return;
    }

    const handled = clickHasBeenHandled(e);

    if (handled) {
      return;
    }

    if (selectionEnabled && e.shiftKey) {
      issueSelectionActions?.shiftToggleSelect(group.id);
      window.getSelection()?.removeAllRanges();
      return;
    }

    if (selectionEnabled && isCtrlKeyPressed(e)) {
      issueSelectionActions?.toggleSelect(group.id);
      return;
    }

    navigate(
      normalizeUrl(
        createIssueLink({
          data: group,
          organization,
          referrer,
          location,
          query,
        })
      )
    );
  };

  const renderCellContent = (column: StreamGroupColumn) => {
    switch (column.key) {
      case 'select':
        return (
          <GroupCheckbox
            group={group}
            displayReprocessingLayout={displayReprocessingLayout}
          />
        );
      case 'issue':
        return (
          <Fragment>
            <Stack flex="1" justify="center" minWidth="0" overflow="hidden">
              <GroupHeaderRow data={group} query={query} source={referrer} />
              <GroupMetaRow data={group} showLifetime={false} />
            </Stack>
            {hasGuideAnchor && <GuideAnchor target="issue_stream" />}
          </Fragment>
        );
      case 'lastSeen':
        return <GroupLastSeen group={group} />;
      case 'firstSeen':
        return <GroupFirstSeen group={group} />;
      case 'graph':
        return issueTypeConfig.stats.enabled && defined(groupStats) ? (
          <Container width="100%">
            <GroupStatusChart
              stats={groupStats}
              secondaryStats={groupSecondaryStats}
              showSecondaryPoints={showSecondaryPoints}
              groupStatus={getBadgeProperties(group.status, group.substatus)?.status}
            />
          </Container>
        ) : issueTypeConfig.stats.enabled ? (
          <Placeholder height="36px" />
        ) : null;
      case 'reprocessingStarted':
      case 'reprocessingEvents':
      case 'reprocessingProgress':
        return <ReprocessingCell column={column} group={group as GroupReprocessing} />;
      case 'event':
        return issueTypeConfig.stats.enabled && defined(primaryCount) ? (
          groupCount
        ) : issueTypeConfig.stats.enabled ? (
          <Placeholder height="18px" width="40px" />
        ) : null;
      case 'users':
        return issueTypeConfig.stats.enabled && defined(primaryUserCount) ? (
          groupUsersCount
        ) : issueTypeConfig.stats.enabled ? (
          <Placeholder height="18px" width="40px" />
        ) : null;
      case 'priority':
        return group.priority ? (
          <GroupPriority group={group} onChange={onPriorityChange} />
        ) : null;
      case 'assignee':
        return withColumns.includes('assigneeAvatar') ? (
          <AssigneeAvatar assignedTo={group.assignedTo} />
        ) : (
          <AssigneeSelector
            group={group}
            assigneeLoading={assigneeLoading}
            handleAssigneeChange={handleAssigneeChange}
            memberList={memberList}
          />
        );
      default:
        return null;
    }
  };

  return (
    <StreamGroupRow
      data-test-id="group"
      data-test-reviewed={reviewed}
      onClick={onClick}
      reviewed={reviewed}
      useTintRow={useTintRow ?? true}
    >
      <InteractionStateLayer as="td" />
      {columns.map(column => (
        <StreamGroupCell
          key={column.key}
          column={column}
          selectionEnabled={selectionEnabled}
        >
          {renderCellContent(column)}
        </StreamGroupCell>
      ))}
    </StreamGroupRow>
  );
}

const CheckboxLabel = styled('label')`
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  height: 100%;
  width: 32px;
  padding-top: 13px;
  padding-left: ${p => p.theme.space.xl};
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${p => p.theme.space.sm};
`;

const StreamGroupRow = styled(SimpleTable.Row, {
  shouldForwardProp: prop => prop !== 'reviewed' && prop !== 'useTintRow',
})<{
  reviewed: boolean;
  useTintRow: boolean;
}>`
  line-height: 1.1;
  min-height: 82px;

  [data-issue-title-link] {
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    }

    &:hover {
      [data-issue-title-primary] {
        text-decoration: underline;
      }
    }
  }

  ${p =>
    p.useTintRow &&
    p.reviewed &&
    css`
      animation: tintRow 0.2s linear forwards;
      position: relative;

      /*
       * A mask that fills the entire row and makes the text opaque. Doing this because
       * opacity adds a stacking context in CSS so we need to apply it to another element.
       */
      &:after {
        content: '';
        pointer-events: none;
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
        background-color: ${p.theme.tokens.background.secondary};
        opacity: 0.4;
      }

      @keyframes tintRow {
        0% {
          background-color: ${p.theme.tokens.background.secondary};
        }
        100% {
          background-color: ${p.theme.tokens.background.secondary};
        }
      }
    `}
`;

const GroupCheckBoxWrapper = styled('div')`
  width: 32px;
  z-index: 1;
`;

const PrimaryCount = styled(Count)`
  font-size: ${p => p.theme.font.size.md};
  display: flex;
  justify-content: right;
  margin-bottom: ${p => p.theme.space['2xs']};
  font-variant-numeric: tabular-nums;
`;

const SecondaryCount = styled(({value, ...p}: any) => <Count {...p} value={value} />)`
  font-size: ${p => p.theme.font.size.sm};
  display: flex;
  justify-content: right;
  color: ${p => p.theme.tokens.content.secondary};
  font-variant-numeric: tabular-nums;

  :before {
    content: '/';
    padding-left: ${p => p.theme.space['2xs']};
    padding-right: 2px;
    color: ${p => p.theme.tokens.content.secondary};
  }
`;

const CountTooltipContent = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  gap: ${p => p.theme.space.md} ${p => p.theme.space['2xl']};
  text-align: left;
  font-size: ${p => p.theme.font.size.md};
  align-items: center;

  h4 {
    color: ${p => p.theme.tokens.content.secondary};
    font-size: ${p => p.theme.font.size.xs};
    text-transform: uppercase;
    grid-column: 1 / -1;
    margin-bottom: ${p => p.theme.space['2xs']};
  }
`;

// Needs to be positioned so that hovering events don't get swallowed by the anchor pseudo-element
const PositionedTimeSince = styled(TimeSince)`
  position: relative;
`;
