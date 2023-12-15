import {Fragment, useCallback, useMemo, useRef} from 'react';
import {css, Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import AssigneeSelector from 'sentry/components/assigneeSelector';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Checkbox from 'sentry/components/checkbox';
import Count from 'sentry/components/count';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import {GroupListColumn} from 'sentry/components/issues/groupList';
import Link from 'sentry/components/links/link';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';
import ProgressBar from 'sentry/components/progressBar';
import {joinQuery, parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import GroupChart from 'sentry/components/stream/groupChart';
import {getRelativeSummary} from 'sentry/components/timeRangeSelector/utils';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t} from 'sentry/locale';
import DemoWalkthroughStore from 'sentry/stores/demoWalkthroughStore';
import GroupStore from 'sentry/stores/groupStore';
import SelectedGroupStore from 'sentry/stores/selectedGroupStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {
  Group,
  GroupReprocessing,
  InboxDetails,
  IssueCategory,
  NewQuery,
  Organization,
  User,
} from 'sentry/types';
import {defined, percent} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoWalkthrough} from 'sentry/utils/demoMode';
import EventView from 'sentry/utils/discover/eventView';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import usePageFilters from 'sentry/utils/usePageFilters';
import withOrganization from 'sentry/utils/withOrganization';
import {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import {
  DISCOVER_EXCLUSION_FIELDS,
  getTabs,
  isForReviewQuery,
} from 'sentry/views/issueList/utils';

export const DEFAULT_STREAM_GROUP_STATS_PERIOD = '24h';

type Props = {
  id: string;
  organization: Organization;
  canSelect?: boolean;
  customStatsPeriod?: TimePeriodType;
  displayReprocessingLayout?: boolean;
  hasGuideAnchor?: boolean;
  index?: number;
  memberList?: User[];
  narrowGroups?: boolean;
  query?: string;
  queryFilterDescription?: string;
  showInboxTime?: boolean;
  showLastTriggered?: boolean;
  source?: string;
  statsPeriod?: string;
  useFilteredStats?: boolean;
  useTintRow?: boolean;
  withChart?: boolean;
  withColumns?: GroupListColumn[];
};

function BaseGroupRow({
  id,
  organization,
  customStatsPeriod,
  displayReprocessingLayout,
  hasGuideAnchor,
  index,
  memberList,
  query,
  queryFilterDescription,
  showInboxTime,
  source,
  statsPeriod = DEFAULT_STREAM_GROUP_STATS_PERIOD,
  canSelect = true,
  withChart = true,
  withColumns = ['graph', 'event', 'users', 'assignee', 'lastTriggered'],
  useFilteredStats = false,
  useTintRow = true,
  narrowGroups = false,
  showLastTriggered = false,
}: Props) {
  const groups = useLegacyStore(GroupStore);
  const group = groups.find(item => item.id === id) as Group;
  const issueTypeConfig = getConfigForIssueType(group, group.project);

  const selectedGroups = useLegacyStore(SelectedGroupStore);
  const isSelected = selectedGroups[id];

  const {selection} = usePageFilters();

  const originalInboxState = useRef(group.inbox as InboxDetails | null);

  const referrer = source ? `${source}-issue-stream` : 'issue-stream';

  const reviewed =
    // Original state had an inbox reason
    originalInboxState.current?.reason !== undefined &&
    // Updated state has been removed from inbox
    !group.inbox &&
    // Only apply reviewed on the "for review" tab
    isForReviewQuery(query);

  const {period, start, end} = selection.datetime || {};
  const summary =
    customStatsPeriod?.label.toLowerCase() ??
    (!!start && !!end
      ? 'time range'
      : getRelativeSummary(period || DEFAULT_STATS_PERIOD).toLowerCase());

  const sharedAnalytics = useMemo(() => {
    const tab = getTabs(organization).find(([tabQuery]) => tabQuery === query)?.[1];
    const owners = group.owners ?? [];
    return {
      organization,
      group_id: group.id,
      tab: tab?.analyticsName || 'other',
      was_shown_suggestion: owners.length > 0,
    };
  }, [organization, group.id, group.owners, query]);

  const trackAssign: React.ComponentProps<typeof AssigneeSelector>['onAssign'] =
    useCallback(
      (type, _assignee, suggestedAssignee) => {
        if (query !== undefined) {
          trackAnalytics('issues_stream.issue_assigned', {
            ...sharedAnalytics,
            did_assign_suggestion: !!suggestedAssignee,
            assigned_suggestion_reason: suggestedAssignee?.suggestedReason,
            assigned_type: type,
          });
        }
      },
      [query, sharedAnalytics]
    );

  const wrapperToggle = useCallback(
    (evt: React.MouseEvent<HTMLDivElement>) => {
      const targetElement = evt.target as Partial<HTMLElement>;

      // Ignore clicks on links
      if (targetElement?.tagName?.toLowerCase() === 'a') {
        return;
      }

      // Ignore clicks on the selection checkbox
      if (targetElement?.tagName?.toLowerCase() === 'input') {
        return;
      }

      let e = targetElement;
      while (e.parentElement) {
        if (e?.tagName?.toLowerCase() === 'a') {
          return;
        }
        e = e.parentElement!;
      }

      if (evt.shiftKey) {
        SelectedGroupStore.shiftToggleItems(group.id);
        window.getSelection()?.removeAllRanges();
      } else {
        SelectedGroupStore.toggleSelect(group.id);
      }
    },
    [group.id]
  );

  const checkboxToggle = useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      const mouseEvent = evt.nativeEvent as MouseEvent;

      if (mouseEvent.shiftKey) {
        SelectedGroupStore.shiftToggleItems(group.id);
      } else {
        SelectedGroupStore.toggleSelect(group.id);
      }
    },
    [group.id]
  );

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
      return discoverView.getResultsViewUrlTarget(organization.slug);
    }

    return {
      pathname: `/organizations/${organization.slug}/issues/${group.id}/events/`,
      query: {
        referrer,
        stream_index: index,
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
          {!defined(count) ? (
            <Placeholder height="17px" />
          ) : (
            <Fragment>
              <Count value={remainingEventsToReprocess} />
              {'/'}
              <Count value={totalEvents} />
            </Fragment>
          )}
        </EventsReprocessedColumn>
        <ProgressColumn>
          <ProgressBar value={remainingEventsToReprocessPercent} />
        </ProgressColumn>
      </Fragment>
    );
  };

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
    withChart && group && group.filtered && statsPeriod && useFilteredStats
  );

  const groupCategoryCountTitles: Record<IssueCategory, string> = {
    [IssueCategory.ERROR]: t('Error Events'),
    [IssueCategory.PERFORMANCE]: t('Transaction Events'),
    [IssueCategory.PROFILE]: t('Profile Events'),
    [IssueCategory.CRON]: t('Cron Events'),
  };

  const groupCount = !defined(primaryCount) ? (
    <Placeholder height="18px" />
  ) : (
    <GuideAnchor target="dynamic_counts" disabled={!hasGuideAnchor}>
      <Tooltip
        disabled={!useFilteredStats}
        isHoverable
        title={
          <CountTooltipContent>
            <h4>{groupCategoryCountTitles[group.issueCategory]}</h4>
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
        <PrimaryCount value={primaryCount} />
        {secondaryCount !== undefined && useFilteredStats && (
          <SecondaryCount value={secondaryCount} />
        )}
      </Tooltip>
    </GuideAnchor>
  );

  const groupUsersCount = !defined(primaryUserCount) ? (
    <Placeholder height="18px" />
  ) : (
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
      <PrimaryCount value={primaryUserCount} />
      {secondaryUserCount !== undefined && useFilteredStats && (
        <SecondaryCount dark value={secondaryUserCount} />
      )}
    </Tooltip>
  );

  const lastTriggered = !defined(lastTriggeredDate) ? (
    <Placeholder height="18px" />
  ) : (
    <TimeSince
      tooltipPrefix={t('Last Triggered')}
      date={lastTriggeredDate}
      suffix={t('ago')}
      unitStyle="short"
    />
  );

  const issueStreamAnchor = isDemoWalkthrough() ? (
    <GuideAnchor target="issue_stream" disabled={!DemoWalkthroughStore.get('issue')} />
  ) : (
    <GuideAnchor target="issue_stream" />
  );

  return (
    <Wrapper
      data-test-id="group"
      data-test-reviewed={reviewed}
      onClick={displayReprocessingLayout || !canSelect ? undefined : wrapperToggle}
      reviewed={reviewed}
      useTintRow={useTintRow ?? true}
    >
      {canSelect && (
        <GroupCheckBoxWrapper>
          <Checkbox
            id={group.id}
            aria-label={t('Select Issue')}
            checked={isSelected}
            disabled={!!displayReprocessingLayout}
            onChange={checkboxToggle}
          />
        </GroupCheckBoxWrapper>
      )}
      <GroupSummary canSelect={canSelect}>
        <EventOrGroupHeader
          index={index}
          organization={organization}
          data={group}
          query={query}
          size="normal"
          source={referrer}
        />
        <EventOrGroupExtraDetails data={group} showInboxTime={showInboxTime} />
      </GroupSummary>
      {hasGuideAnchor && issueStreamAnchor}

      {withChart && !displayReprocessingLayout && issueTypeConfig.stats.enabled && (
        <ChartWrapper narrowGroups={narrowGroups}>
          <GroupChart
            statsPeriod={statsPeriod!}
            data={group}
            showSecondaryPoints={showSecondaryPoints}
            showMarkLine
          />
        </ChartWrapper>
      )}
      {displayReprocessingLayout ? (
        renderReprocessingColumns()
      ) : (
        <Fragment>
          {withColumns.includes('event') && issueTypeConfig.stats.enabled && (
            <EventCountsWrapper>{groupCount}</EventCountsWrapper>
          )}
          {withColumns.includes('users') && issueTypeConfig.stats.enabled && (
            <EventCountsWrapper>{groupUsersCount}</EventCountsWrapper>
          )}
          {withColumns.includes('assignee') && (
            <AssigneeWrapper narrowGroups={narrowGroups}>
              <AssigneeSelector
                id={group.id}
                memberList={memberList}
                onAssign={trackAssign}
              />
            </AssigneeWrapper>
          )}
          {showLastTriggered && <EventCountsWrapper>{lastTriggered}</EventCountsWrapper>}
        </Fragment>
      )}
    </Wrapper>
  );
}

const StreamGroup = withOrganization(BaseGroupRow);

export default StreamGroup;

// Position for wrapper is relative for overlay actions
const Wrapper = styled(PanelItem)<{
  reviewed: boolean;
  useTintRow: boolean;
}>`
  position: relative;
  padding: ${space(1.5)} 0;
  line-height: 1.1;

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
        background-color: ${p.theme.bodyBackground};
        opacity: 0.4;
      }

      @keyframes tintRow {
        0% {
          background-color: ${p.theme.bodyBackground};
        }
        100% {
          background-color: ${p.theme.backgroundSecondary};
        }
      }
    `};
`;

const GroupSummary = styled('div')<{canSelect: boolean}>`
  overflow: hidden;
  margin-left: ${p => space(p.canSelect ? 1 : 2)};
  margin-right: ${space(1)};
  flex: 1;
  width: 66.66%;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    width: 50%;
  }
`;

const GroupCheckBoxWrapper = styled('div')`
  margin-left: ${space(2)};
  align-self: flex-start;
  height: 15px;
  display: flex;
  align-items: center;
`;

const primaryStatStyle = (theme: Theme) => css`
  font-size: ${theme.fontSizeLarge};
  font-variant-numeric: tabular-nums;
`;

const PrimaryCount = styled(Count)`
  ${p => primaryStatStyle(p.theme)};
`;

const secondaryStatStyle = (theme: Theme) => css`
  font-size: ${theme.fontSizeLarge};
  font-variant-numeric: tabular-nums;

  :before {
    content: '/';
    padding-left: ${space(0.25)};
    padding-right: 2px;
    color: ${theme.gray300};
  }
`;

const SecondaryCount = styled(({value, ...p}) => <Count {...p} value={value} />)`
  ${p => secondaryStatStyle(p.theme)}
`;

const CountTooltipContent = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  gap: ${space(1)} ${space(3)};
  text-align: left;
  font-size: ${p => p.theme.fontSizeMedium};
  align-items: center;

  h4 {
    color: ${p => p.theme.gray300};
    font-size: ${p => p.theme.fontSizeExtraSmall};
    text-transform: uppercase;
    grid-column: 1 / -1;
    margin-bottom: ${space(0.25)};
  }
`;

const ChartWrapper = styled('div')<{narrowGroups: boolean}>`
  width: 200px;
  align-self: center;

  @media (max-width: ${p =>
      p.narrowGroups ? p.theme.breakpoints.xlarge : p.theme.breakpoints.large}) {
    display: none;
  }
`;

const EventCountsWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-self: center;
  width: 60px;
  margin: 0 ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    width: 80px;
  }
`;

const AssigneeWrapper = styled('div')<{narrowGroups: boolean}>`
  width: 80px;
  margin: 0 ${space(2)};
  align-self: center;

  @media (max-width: ${p =>
      p.narrowGroups ? p.theme.breakpoints.large : p.theme.breakpoints.medium}) {
    display: none;
  }
`;

// Reprocessing
const StartedColumn = styled('div')`
  align-self: center;
  margin: 0 ${space(2)};
  color: ${p => p.theme.gray500};
  ${p => p.theme.overflowEllipsis};
  width: 85px;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: block;
    width: 140px;
  }
`;

const EventsReprocessedColumn = styled('div')`
  align-self: center;
  margin: 0 ${space(2)};
  color: ${p => p.theme.gray500};
  ${p => p.theme.overflowEllipsis};
  width: 75px;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    width: 140px;
  }
`;

const ProgressColumn = styled('div')`
  margin: 0 ${space(2)};
  align-self: center;
  display: none;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: block;
    width: 160px;
  }
`;
