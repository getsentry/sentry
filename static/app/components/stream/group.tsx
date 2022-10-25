import {Fragment, useCallback, useMemo, useRef} from 'react';
import {css, Theme} from '@emotion/react';
import styled from '@emotion/styled';
import classNames from 'classnames';
import type {LocationDescriptor} from 'history';

import AssigneeSelector from 'sentry/components/assigneeSelector';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Checkbox from 'sentry/components/checkbox';
import Count from 'sentry/components/count';
import DeprecatedDropdownMenu from 'sentry/components/deprecatedDropdownMenu';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import Link from 'sentry/components/links/link';
import MenuItem from 'sentry/components/menuItem';
import {getRelativeSummary} from 'sentry/components/organizations/timeRangeSelector/utils';
import {PanelItem} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import ProgressBar from 'sentry/components/progressBar';
import {joinQuery, parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import GroupChart from 'sentry/components/stream/groupChart';
import TimeSince from 'sentry/components/timeSince';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import SelectedGroupStore from 'sentry/stores/selectedGroupStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import space from 'sentry/styles/space';
import {
  Group,
  GroupReprocessing,
  InboxDetails,
  NewQuery,
  Organization,
  User,
} from 'sentry/types';
import {defined, percent} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import usePageFilters from 'sentry/utils/usePageFilters';
import withOrganization from 'sentry/utils/withOrganization';
import {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import {
  DISCOVER_EXCLUSION_FIELDS,
  getTabs,
  isForReviewQuery,
  Query,
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
  source?: string;
  statsPeriod?: string;
  useFilteredStats?: boolean;
  useTintRow?: boolean;
  withChart?: boolean;
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
  useFilteredStats = false,
  useTintRow = true,
  narrowGroups = false,
}: Props) {
  const groups = useLegacyStore(GroupStore);
  const group = groups.find(item => item.id === id) as Group;

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

  const trackClick = useCallback(() => {
    if (query === Query.FOR_REVIEW) {
      trackAdvancedAnalyticsEvent('inbox_tab.issue_clicked', {
        organization,
        group_id: group.id,
      });
    }

    if (query !== undefined) {
      trackAdvancedAnalyticsEvent('issues_stream.issue_clicked', sharedAnalytics);
    }
  }, [organization, group.id, query, sharedAnalytics]);

  const trackAssign: React.ComponentProps<typeof AssigneeSelector>['onAssign'] =
    useCallback(
      (type, _assignee, suggestedAssignee) => {
        if (query !== undefined) {
          trackAdvancedAnalyticsEvent('issues_stream.issue_assigned', {
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
      p => !(p.type === Token.Filter && DISCOVER_EXCLUSION_FIELDS.includes(p.key.text))
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
        query: `issue.id:${group.id}${filteredQuery}`,
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

  const showSecondaryPoints = Boolean(
    withChart && group && group.filtered && statsPeriod && useFilteredStats
  );

  const groupCount = !defined(primaryCount) ? (
    <Placeholder height="18px" />
  ) : (
    <DeprecatedDropdownMenu isNestedDropdown>
      {({isOpen, getRootProps, getActorProps, getMenuProps}) => {
        const topLevelCx = classNames('dropdown', {'anchor-middle': true, open: isOpen});

        return (
          <GuideAnchor target="dynamic_counts" disabled={!hasGuideAnchor}>
            <span {...getRootProps({className: topLevelCx})}>
              <span {...getActorProps({})}>
                <div className="dropdown-actor-title">
                  <PrimaryCount value={primaryCount} />
                  {secondaryCount !== undefined && useFilteredStats && (
                    <SecondaryCount value={secondaryCount} />
                  )}
                </div>
              </span>
              {useFilteredStats && (
                <StyledDropdownList
                  {...getMenuProps({className: 'dropdown-menu inverted'})}
                >
                  {group.filtered && (
                    <Fragment>
                      <StyledMenuItem to={getDiscoverUrl(true)}>
                        <MenuItemText>
                          {queryFilterDescription ?? t('Matching search filters')}
                        </MenuItemText>
                        <MenuItemCount value={group.filtered.count} />
                      </StyledMenuItem>
                      <MenuItem divider />
                    </Fragment>
                  )}

                  <StyledMenuItem to={getDiscoverUrl()}>
                    <MenuItemText>{t('Total in %s', summary)}</MenuItemText>
                    <MenuItemCount value={group.count} />
                  </StyledMenuItem>

                  {group.lifetime && (
                    <Fragment>
                      <MenuItem divider />
                      <StyledMenuItem>
                        <MenuItemText>{t('Since issue began')}</MenuItemText>
                        <MenuItemCount value={group.lifetime.count} />
                      </StyledMenuItem>
                    </Fragment>
                  )}
                </StyledDropdownList>
              )}
            </span>
          </GuideAnchor>
        );
      }}
    </DeprecatedDropdownMenu>
  );

  const groupUsersCount = !defined(primaryUserCount) ? (
    <Placeholder height="18px" />
  ) : (
    <DeprecatedDropdownMenu isNestedDropdown>
      {({isOpen, getRootProps, getActorProps, getMenuProps}) => {
        const topLevelCx = classNames('dropdown', {'anchor-middle': true, open: isOpen});

        return (
          <span {...getRootProps({className: topLevelCx})}>
            <span {...getActorProps({})}>
              <div className="dropdown-actor-title">
                <PrimaryCount value={primaryUserCount} />
                {secondaryUserCount !== undefined && useFilteredStats && (
                  <SecondaryCount dark value={secondaryUserCount} />
                )}
              </div>
            </span>
            {useFilteredStats && (
              <StyledDropdownList
                {...getMenuProps({className: 'dropdown-menu inverted'})}
              >
                {group.filtered && (
                  <Fragment>
                    <StyledMenuItem to={getDiscoverUrl(true)}>
                      <MenuItemText>
                        {queryFilterDescription ?? t('Matching search filters')}
                      </MenuItemText>
                      <MenuItemCount value={group.filtered.userCount} />
                    </StyledMenuItem>
                    <MenuItem divider />
                  </Fragment>
                )}

                <StyledMenuItem to={getDiscoverUrl()}>
                  <MenuItemText>{t('Total in %s', summary)}</MenuItemText>
                  <MenuItemCount value={group.userCount} />
                </StyledMenuItem>

                {group.lifetime && (
                  <Fragment>
                    <MenuItem divider />
                    <StyledMenuItem>
                      <MenuItemText>{t('Since issue began')}</MenuItemText>
                      <MenuItemCount value={group.lifetime.userCount} />
                    </StyledMenuItem>
                  </Fragment>
                )}
              </StyledDropdownList>
            )}
          </span>
        );
      }}
    </DeprecatedDropdownMenu>
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
          includeLink
          data={group}
          query={query}
          size="normal"
          onClick={trackClick}
          source={referrer}
        />
        <EventOrGroupExtraDetails data={group} showInboxTime={showInboxTime} />
      </GroupSummary>
      {hasGuideAnchor && <GuideAnchor target="issue_stream" />}
      {withChart && !displayReprocessingLayout && (
        <ChartWrapper
          className={`hidden-xs hidden-sm ${narrowGroups ? 'hidden-md' : ''}`}
        >
          {!group.filtered?.stats && !group.stats ? (
            <Placeholder height="24px" />
          ) : (
            <GroupChart
              statsPeriod={statsPeriod!}
              data={group}
              showSecondaryPoints={showSecondaryPoints}
              showMarkLine
            />
          )}
        </ChartWrapper>
      )}
      {displayReprocessingLayout ? (
        renderReprocessingColumns()
      ) : (
        <Fragment>
          <EventCountsWrapper>{groupCount}</EventCountsWrapper>
          <EventCountsWrapper>{groupUsersCount}</EventCountsWrapper>
          <AssigneeWrapper className="hidden-xs hidden-sm">
            <AssigneeSelector
              id={group.id}
              memberList={memberList}
              onAssign={trackAssign}
            />
          </AssigneeWrapper>
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

  & input[type='checkbox'] {
    margin: 0;
    display: block;
  }
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

const StyledDropdownList = styled('ul')`
  z-index: ${p => p.theme.zIndex.hovercard};
`;

interface MenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  to?: LocationDescriptor;
}

const StyledMenuItem = styled(({to, children, ...p}: MenuItemProps) => (
  <MenuItem noAnchor>
    {to ? (
      // @ts-expect-error allow target _blank for this link to open in new window
      <Link to={to} target="_blank">
        <div {...p}>{children}</div>
      </Link>
    ) : (
      <div className="dropdown-toggle">
        <div {...p}>{children}</div>
      </div>
    )}
  </MenuItem>
))`
  margin: 0;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const menuItemStatStyles = css`
  text-align: right;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
  padding-left: ${space(1)};
`;

const MenuItemCount = styled(({value, ...p}) => (
  <div {...p}>
    <Count value={value} />
  </div>
))`
  ${menuItemStatStyles};
  color: ${p => p.theme.subText};
`;

const MenuItemText = styled('div')`
  white-space: nowrap;
  font-weight: normal;
  text-align: left;
  padding-right: ${space(1)};
  color: ${p => p.theme.textColor};
`;

const ChartWrapper = styled('div')`
  width: 200px;
  align-self: center;
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

const AssigneeWrapper = styled('div')`
  width: 80px;
  margin: 0 ${space(2)};
  align-self: center;
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
