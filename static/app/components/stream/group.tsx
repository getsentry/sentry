import {Fragment, useCallback, useMemo, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {Stack} from '@sentry/scraps/layout';

import {assignToActor, clearAssignment} from 'sentry/actionCreators/group';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {AssignableEntity} from 'sentry/components/assigneeSelectorDropdown';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import GroupStatusChart from 'sentry/components/charts/groupStatusChart';
import {Checkbox} from 'sentry/components/core/checkbox';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import {AssigneeSelector} from 'sentry/components/group/assigneeSelector';
import {getBadgeProperties} from 'sentry/components/group/inboxBadges/statusBadge';
import type {GroupListColumn} from 'sentry/components/issues/groupList';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';
import ProgressBar from 'sentry/components/progressBar';
import {joinQuery, parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import {getRelativeSummary} from 'sentry/components/timeRangeSelector/utils';
import TimeSince from 'sentry/components/timeSince';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import SelectedGroupStore from 'sentry/stores/selectedGroupStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {TimeseriesValue} from 'sentry/types/core';
import type {
  Group,
  GroupReprocessing,
  InboxDetails,
  PriorityLevel,
} from 'sentry/types/group';
import type {NewQuery} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {defined, percent} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {isCtrlKeyPressed} from 'sentry/utils/isCtrlKeyPressed';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import GroupPriority from 'sentry/views/issueDetails/groupPriority';
import {COLUMN_BREAKPOINTS} from 'sentry/views/issueList/actions/utils';
import {
  createIssueLink,
  DISCOVER_EXCLUSION_FIELDS,
  isForReviewQuery,
} from 'sentry/views/issueList/utils';

export const DEFAULT_STREAM_GROUP_STATS_PERIOD = '24h';
const COLUMNS: GroupListColumn[] = [
  'graph',
  'event',
  'users',
  'priority',
  'assignee',
  'lastTriggered',
];

type Props = {
  id: string;
  canSelect?: boolean;
  customStatsPeriod?: TimePeriodType;
  displayReprocessingLayout?: boolean;
  /**
   * If you have access to the group data, it is preferred to pass it in as a prop here.
   * Otherwise, the group data will come from the deprecated GroupStore.
   */
  group?: Group;
  hasGuideAnchor?: boolean;
  memberList?: User[];
  onAssigneeChange?: (newAssignee: AssignableEntity | null) => void;
  onPriorityChange?: (newPriority: PriorityLevel) => void;
  query?: string;
  queryFilterDescription?: string;
  showLastTriggered?: boolean;
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
  const {records: selectedGroupMap} = useLegacyStore(SelectedGroupStore);
  const isSelected = selectedGroupMap.get(group.id) ?? false;

  const handleToggle = useCallback(
    (isShiftClick: boolean) => {
      if (isShiftClick) {
        SelectedGroupStore.shiftToggleItems(group.id);
      } else {
        SelectedGroupStore.toggleSelect(group.id);
      }
    },
    [group.id]
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
      {!group.hasSeen && (
        <Tooltip title={t('Unread')} skipWrapper>
          <UnreadIndicator
            data-test-id="unread-issue-indicator"
            onClick={(e: React.MouseEvent) => {
              // Toggle checkbox on unread indicator misclick
              e.stopPropagation();
              handleToggle(e.shiftKey);
            }}
          />
        </Tooltip>
      )}
      <CheckboxLabel>
        <CheckboxWithBackground
          id={group.id}
          aria-label={t('Select Issue')}
          checked={isSelected}
          disabled={!!displayReprocessingLayout}
          onChange={onChange}
        />
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
  'displayReprocessingLayout' | 'withChart' | 'withColumns' | 'showLastTriggered'
>;

export function LoadingStreamGroup({
  displayReprocessingLayout,
  withChart = true,
  withColumns = COLUMNS,
  showLastTriggered = false,
}: LoadingSteamGroupProps) {
  return (
    <Wrapper data-test-id="group" useTintRow={false} reviewed={false}>
      <GroupSummary canSelect={false}>
        <Placeholder height="58px" />
      </GroupSummary>
      {withColumns.includes('lastSeen') && (
        <LastSeenWrapper breakpoint={COLUMN_BREAKPOINTS.LAST_SEEN}>
          <Placeholder height="18px" width="70px" />
        </LastSeenWrapper>
      )}
      {withColumns.includes('firstSeen') && (
        <FirstSeenWrapper breakpoint={COLUMN_BREAKPOINTS.FIRST_SEEN}>
          <Placeholder height="18px" width="30px" />
        </FirstSeenWrapper>
      )}
      {withChart && !displayReprocessingLayout && (
        <ChartWrapper breakpoint={COLUMN_BREAKPOINTS.TREND}>
          <Placeholder height="36px" />
        </ChartWrapper>
      )}
      {displayReprocessingLayout ? (
        <Fragment>
          <StartedColumn>
            <Placeholder height="17px" />
          </StartedColumn>
          <EventsReprocessedColumn>
            <Placeholder height="17px" />
          </EventsReprocessedColumn>
          <ProgressColumn>
            <Placeholder height="17px" />
          </ProgressColumn>
        </Fragment>
      ) : (
        <Fragment>
          {showLastTriggered && (
            <LastTriggeredWrapper>
              <Placeholder height="18px" />
            </LastTriggeredWrapper>
          )}
          {withColumns.includes('event') && (
            <NarrowEventsOrUsersCountsWrapper breakpoint={COLUMN_BREAKPOINTS.EVENTS}>
              <Placeholder height="18px" width="40px" />
            </NarrowEventsOrUsersCountsWrapper>
          )}
          {withColumns.includes('users') && (
            <NarrowEventsOrUsersCountsWrapper breakpoint={COLUMN_BREAKPOINTS.USERS}>
              <Placeholder height="18px" width="40px" />
            </NarrowEventsOrUsersCountsWrapper>
          )}
          {withColumns.includes('assignee') && (
            <AssigneeWrapper breakpoint={COLUMN_BREAKPOINTS.ASSIGNEE}>
              <Placeholder height="24px" />
            </AssigneeWrapper>
          )}
          {withColumns.includes('priority') && (
            <PriorityWrapper breakpoint={COLUMN_BREAKPOINTS.PRIORITY}>
              <Placeholder height="24px" />
            </PriorityWrapper>
          )}
        </Fragment>
      )}
    </Wrapper>
  );
}

function StreamGroup({
  id,
  group: incomingGroup,
  customStatsPeriod,
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
  showLastTriggered = false,
  onPriorityChange,
  onAssigneeChange,
}: Props) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const groups = useLegacyStore(GroupStore);
  const group = useMemo(() => {
    if (incomingGroup) {
      return incomingGroup;
    }
    return groups.find(item => item.id === id) as Group | undefined;
  }, [incomingGroup, groups, id]);
  const originalInboxState = useRef(group?.inbox as InboxDetails | null);
  const {selection} = usePageFilters();

  const referrer = source ? `${source}-issue-stream` : 'issue-stream';

  const {period, start, end} = selection.datetime || {};

  const summary =
    customStatsPeriod?.label?.toLowerCase() ??
    (!!start && !!end
      ? 'time range'
      : getRelativeSummary(period || DEFAULT_STATS_PERIOD).toLowerCase());

  const sharedAnalytics = useMemo(() => {
    const owners = group?.owners ?? [];
    return {
      organization,
      group_id: group?.id ?? '',
      was_shown_suggestion: owners.length > 0,
    };
  }, [organization, group]);

  const {mutate: handleAssigneeChange, isPending: assigneeLoading} = useMutation<
    AssignableEntity | null,
    RequestError,
    AssignableEntity | null
  >({
    mutationFn: async (
      newAssignee: AssignableEntity | null
    ): Promise<AssignableEntity | null> => {
      if (newAssignee) {
        await assignToActor({
          id: group!.id,
          orgSlug: organization.slug,
          actor: {id: newAssignee.id, type: newAssignee.type},
          assignedBy: 'assignee_selector',
        });
        return Promise.resolve(newAssignee);
      }

      await clearAssignment(group!.id, organization.slug, 'assignee_selector');
      return Promise.resolve(null);
    },
    onSuccess: (newAssignee: AssignableEntity | null) => {
      if (query !== undefined && newAssignee) {
        trackAnalytics('issues_stream.issue_assigned', {
          ...sharedAnalytics,
          did_assign_suggestion: !!newAssignee.suggestedAssignee,
          assigned_suggestion_reason: newAssignee.suggestedAssignee?.suggestedReason,
          assigned_type: newAssignee.type,
        });
      }
      onAssigneeChange?.(newAssignee);
    },
    onError: () => {
      addErrorMessage('Failed to update assignee');
    },
  });

  const clickHasBeenHandled = useCallback(
    (evt: React.MouseEvent<HTMLDivElement>) => {
      const targetElement = evt.target as Partial<HTMLElement>;
      if (!group) {
        return true;
      }

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
    },
    [group]
  );

  const groupStats = useMemo<readonly TimeseriesValue[]>(() => {
    if (!group) {
      return [];
    }

    return group.filtered
      ? group.filtered.stats?.[statsPeriod]!
      : group.stats?.[statsPeriod]!;
  }, [group, statsPeriod]);

  const groupSecondaryStats = useMemo<readonly TimeseriesValue[]>(() => {
    if (!group) {
      return [];
    }

    return group.filtered ? group.stats?.[statsPeriod]! : [];
  }, [group, statsPeriod]);

  if (!group) {
    return null;
  }

  const getDiscoverUrl = (isFiltered?: boolean): LocationDescriptor => {
    // when there is no discover feature open events page
    const hasDiscoverQuery = organization.features.includes('discover-basic');

    const parsedResult = parseSearch(
      isFiltered && typeof query === 'string' ? query : ''
    );
    const filteredTerms = parsedResult?.filter(
      p => !(p.type === Token.FILTER && DISCOVER_EXCLUSION_FIELDS.includes(p.key.text))
    );
    const filteredQuery = joinQuery(filteredTerms, true);

    const commonQuery = {projects: [Number(group.project.id)]};

    if (hasDiscoverQuery) {
      const stats = customStatsPeriod ?? (selection.datetime || {});

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

  const renderReprocessingColumns = () => {
    const {statusDetails, count} = group as GroupReprocessing;
    const {info, pendingEvents} = statusDetails;

    if (!info) {
      return null;
    }

    const {totalEvents, dateCreated} = info;

    const remainingEventsToReprocess = totalEvents - pendingEvents;
    const remainingEventsToReprocessPercent = percent(
      remainingEventsToReprocess,
      totalEvents
    );

    return (
      <Fragment>
        <StartedColumn>
          <TimeSince date={dateCreated} />
        </StartedColumn>
        <EventsReprocessedColumn>
          {defined(count) ? (
            <Fragment>
              <Count value={remainingEventsToReprocess} />
              {'/'}
              <Count value={totalEvents} />
            </Fragment>
          ) : (
            <Placeholder height="17px" />
          )}
        </EventsReprocessedColumn>
        <ProgressColumn>
          <ProgressBar value={remainingEventsToReprocessPercent} />
        </ProgressColumn>
      </Fragment>
    );
  };

  const issueTypeConfig = getConfigForIssueType(group, group.project);
  const reviewed =
    // Original state had an inbox reason
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
  const lastTriggeredDate = group.lastTriggered;

  const showSecondaryPoints = Boolean(
    withChart && group?.filtered && statsPeriod && useFilteredStats
  );

  const groupCount = (
    <GuideAnchor target="dynamic_counts" disabled={!hasGuideAnchor}>
      <Tooltip
        disabled={!useFilteredStats}
        isHoverable
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
    </GuideAnchor>
  );

  const groupUsersCount = (
    <Tooltip
      isHoverable
      disabled={!usePageFilters}
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

  const lastTriggered = defined(lastTriggeredDate) ? (
    <PositionedTimeSince
      tooltipPrefix={t('Last Triggered')}
      date={lastTriggeredDate}
      suffix={t('ago')}
      unitStyle="short"
    />
  ) : (
    <Placeholder height="18px" />
  );

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (displayReprocessingLayout) {
      return;
    }

    const handled = clickHasBeenHandled(e);

    if (handled) {
      return;
    }

    if (canSelect && e.shiftKey) {
      SelectedGroupStore.shiftToggleItems(group.id);
      window.getSelection()?.removeAllRanges();
      return;
    }

    if (canSelect && isCtrlKeyPressed(e)) {
      SelectedGroupStore.toggleSelect(group.id);
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

  return (
    <Wrapper
      data-test-id="group"
      data-test-reviewed={reviewed}
      onClick={onClick}
      reviewed={reviewed}
      useTintRow={useTintRow ?? true}
    >
      <InteractionStateLayer />
      <Fragment>
        {canSelect && (
          <GroupCheckbox
            group={group}
            displayReprocessingLayout={displayReprocessingLayout}
          />
        )}
        <GroupSummary canSelect={canSelect}>
          <EventOrGroupHeader data={group} query={query} source={referrer} />
          <EventOrGroupExtraDetails data={group} showLifetime={false} />
        </GroupSummary>
      </Fragment>
      {hasGuideAnchor && <GuideAnchor target="issue_stream" />}

      {withColumns.includes('lastSeen') && (
        <LastSeenWrapper breakpoint={COLUMN_BREAKPOINTS.LAST_SEEN}>
          <GroupLastSeen group={group} />
        </LastSeenWrapper>
      )}

      {withColumns.includes('firstSeen') && (
        <FirstSeenWrapper breakpoint={COLUMN_BREAKPOINTS.FIRST_SEEN}>
          <GroupFirstSeen group={group} />
        </FirstSeenWrapper>
      )}

      {withChart && !displayReprocessingLayout && (
        <ChartWrapper breakpoint={COLUMN_BREAKPOINTS.TREND}>
          {issueTypeConfig.stats.enabled && defined(groupStats) ? (
            <GroupStatusChart
              hideZeros
              stats={groupStats}
              secondaryStats={groupSecondaryStats}
              showSecondaryPoints={showSecondaryPoints}
              groupStatus={getBadgeProperties(group.status, group.substatus)?.status}
              showMarkLine
            />
          ) : issueTypeConfig.stats.enabled ? (
            <Placeholder height="36px" />
          ) : null}
        </ChartWrapper>
      )}
      {displayReprocessingLayout ? (
        renderReprocessingColumns()
      ) : (
        <Fragment>
          {showLastTriggered && (
            <LastTriggeredWrapper>{lastTriggered}</LastTriggeredWrapper>
          )}
          {withColumns.includes('event') && (
            <NarrowEventsOrUsersCountsWrapper breakpoint={COLUMN_BREAKPOINTS.EVENTS}>
              {issueTypeConfig.stats.enabled && defined(primaryCount) ? (
                groupCount
              ) : issueTypeConfig.stats.enabled ? (
                <Placeholder height="18px" width="40px" />
              ) : null}
            </NarrowEventsOrUsersCountsWrapper>
          )}
          {withColumns.includes('users') && (
            <NarrowEventsOrUsersCountsWrapper breakpoint={COLUMN_BREAKPOINTS.USERS}>
              {issueTypeConfig.stats.enabled && defined(primaryUserCount) ? (
                groupUsersCount
              ) : issueTypeConfig.stats.enabled ? (
                <Placeholder height="18px" width="40px" />
              ) : null}
            </NarrowEventsOrUsersCountsWrapper>
          )}
          {withColumns.includes('priority') && (
            <PriorityWrapper breakpoint={COLUMN_BREAKPOINTS.PRIORITY}>
              {group.priority ? (
                <GroupPriority group={group} onChange={onPriorityChange} />
              ) : null}
            </PriorityWrapper>
          )}
          {withColumns.includes('assignee') && (
            <AssigneeWrapper breakpoint={COLUMN_BREAKPOINTS.ASSIGNEE}>
              <AssigneeSelector
                group={group}
                assigneeLoading={assigneeLoading}
                handleAssigneeChange={handleAssigneeChange}
                memberList={memberList}
              />
            </AssigneeWrapper>
          )}
        </Fragment>
      )}
    </Wrapper>
  );
}

export default StreamGroup;

const CheckboxLabel = styled('label')`
  position: absolute;
  top: -1px;
  left: 0;
  bottom: 0;
  height: 100%;
  width: 32px;
  padding-left: ${space(2)};
  margin: 0;
  margin-top: -1px;
  display: flex;
  align-items: center;
`;

const UnreadIndicator = styled('div')`
  width: 8px;
  height: 8px;
  background-color: ${p => p.theme.tokens.graphics.accent.vibrant};
  border-radius: 50%;
  margin-top: 1px;
  margin-left: ${space(2)};
  z-index: 1;
`;

// Position for wrapper is relative for overlay actions
const Wrapper = styled(PanelItem)<{
  reviewed: boolean;
  useTintRow: boolean;
}>`
  position: relative;
  line-height: 1.1;
  padding: ${space(1)} 0;
  min-height: 82px;

  &:not(:has(:hover)):not(:has(input:checked)) {
    ${CheckboxLabel} {
      ${p => p.theme.visuallyHidden};
    }
  }

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
    `};
`;

export const GroupSummary = styled('div')<{canSelect: boolean}>`
  overflow: hidden;
  margin-left: ${p => space(p.canSelect ? 1 : 2)};
  margin-right: ${space(4)};
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  font-size: ${p => p.theme.fontSize.md};
  width: auto;
`;

const GroupCheckBoxWrapper = styled('div')`
  align-self: flex-start;
  width: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: ${space(1)};
  z-index: 1;
`;

const CheckboxWithBackground = styled(Checkbox)`
  background-color: ${p => p.theme.tokens.background.primary};
`;

const PrimaryCount = styled(Count)`
  font-size: ${p => p.theme.fontSize.md};
  display: flex;
  justify-content: right;
  margin-bottom: ${space(0.25)};
  font-variant-numeric: tabular-nums;
`;

const SecondaryCount = styled(({value, ...p}: any) => <Count {...p} value={value} />)`
  font-size: ${p => p.theme.fontSize.sm};
  display: flex;
  justify-content: right;
  color: ${p => p.theme.tokens.content.secondary};
  font-variant-numeric: tabular-nums;

  :before {
    content: '/';
    padding-left: ${space(0.25)};
    padding-right: 2px;
    color: ${p => p.theme.tokens.content.secondary};
  }
`;

const CountTooltipContent = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  gap: ${space(1)} ${space(3)};
  text-align: left;
  font-size: ${p => p.theme.fontSize.md};
  align-items: center;

  h4 {
    color: ${p => p.theme.tokens.content.secondary};
    font-size: ${p => p.theme.fontSize.xs};
    text-transform: uppercase;
    grid-column: 1 / -1;
    margin-bottom: ${space(0.25)};
  }
`;

const ChartWrapper = styled('div')<{breakpoint: string}>`
  width: 175px;
  align-self: center;
  margin-right: ${space(2)};

  @container (width < ${p => p.breakpoint}) {
    display: none;
  }
`;

const LastSeenWrapper = styled('div')<{breakpoint: string}>`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 86px;
  padding-right: ${space(2)};
  margin-right: ${space(2)};

  @container (width < ${p => p.breakpoint}) {
    display: none;
  }
`;

const FirstSeenWrapper = styled('div')<{breakpoint: string}>`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 50px;
  padding-right: ${space(2)};
  margin-right: ${space(2)};

  @container (width < ${p => p.breakpoint}) {
    display: none;
  }
`;

const NarrowEventsOrUsersCountsWrapper = styled('div')<{breakpoint: string}>`
  display: flex;
  justify-content: flex-end;
  text-align: right;
  align-items: center;
  align-self: center;
  padding-right: ${space(2)};
  margin-right: ${space(2)};
  width: 60px;

  @container (width < ${p => p.breakpoint}) {
    display: none;
  }
`;

const LastTriggeredWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-self: center;
  width: 100px;
  padding-right: ${space(2)};
  margin-right: ${space(2)};
`;

const PriorityWrapper = styled('div')<{breakpoint: string}>`
  width: 64px;
  padding-right: ${space(2)};
  margin-right: ${space(2)};
  align-self: center;
  display: flex;
  justify-content: flex-end;

  @container (width < ${p => p.breakpoint}) {
    display: none;
  }
`;

const AssigneeWrapper = styled('div')<{breakpoint: string}>`
  display: flex;
  justify-content: flex-end;
  text-align: right;
  width: 66px;
  padding-right: ${space(2)};
  margin-right: ${space(2)};
  align-self: center;

  @media (max-width: ${p => p.breakpoint}) {
    display: none;
  }
`;

// Reprocessing
const StartedColumn = styled('div')`
  align-self: center;
  margin: 0 ${space(2)};
  color: ${p => p.theme.colors.gray800};
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 85px;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    display: block;
    width: 140px;
  }
`;

const EventsReprocessedColumn = styled('div')`
  align-self: center;
  margin: 0 ${space(2)};
  color: ${p => p.theme.colors.gray800};
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 75px;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    width: 140px;
  }
`;

const ProgressColumn = styled('div')`
  margin: 0 ${space(2)};
  align-self: center;
  display: none;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    display: block;
    width: 160px;
  }
`;

// Needs to be positioned so that hovering events don't get swallowed by the anchor pseudo-element
const PositionedTimeSince = styled(TimeSince)`
  position: relative;
`;
