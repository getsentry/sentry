import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';
import classNames from 'classnames';
// eslint-disable-next-line no-restricted-imports
import {Box} from 'reflexbox';

import AssigneeSelector from 'app/components/assigneeSelector';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import Count from 'app/components/count';
import DropdownMenu from 'app/components/dropdownMenu';
import EventOrGroupExtraDetails from 'app/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import Link from 'app/components/links/link';
import MenuItem from 'app/components/menuItem';
import {getRelativeSummary} from 'app/components/organizations/timeRangeSelector/utils';
import {PanelItem} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import ProgressBar from 'app/components/progressBar';
import GroupChart from 'app/components/stream/groupChart';
import GroupCheckBox from 'app/components/stream/groupCheckBox';
import GroupRowActions from 'app/components/stream/groupRowActions';
import TimeSince from 'app/components/timeSince';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {t} from 'app/locale';
import GroupStore from 'app/stores/groupStore';
import SelectedGroupStore from 'app/stores/selectedGroupStore';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {
  GlobalSelection,
  Group,
  GroupReprocessing,
  InboxDetails,
  NewQuery,
  Organization,
  User,
} from 'app/types';
import {defined, percent, valueIsEqual} from 'app/utils';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {callIfFunction} from 'app/utils/callIfFunction';
import EventView from 'app/utils/discover/eventView';
import {queryToObj} from 'app/utils/stream';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import {getTabs, isForReviewQuery} from 'app/views/issueList/utils';

const DiscoveryExclusionFields: string[] = [
  'query',
  'status',
  'bookmarked_by',
  'assigned',
  'assigned_to',
  'unassigned',
  'subscribed_by',
  'active_at',
  'first_release',
  'first_seen',
  'is',
  '__text',
];

export const DEFAULT_STREAM_GROUP_STATS_PERIOD = '24h';

const defaultProps = {
  statsPeriod: DEFAULT_STREAM_GROUP_STATS_PERIOD,
  canSelect: true,
  withChart: true,
  useFilteredStats: false,
};

type Props = {
  id: string;
  selection: GlobalSelection;
  organization: Organization;
  displayReprocessingLayout?: boolean;
  query?: string;
  hasGuideAnchor?: boolean;
  memberList?: User[];
  onMarkReviewed?: (itemIds: string[]) => void;
  onDelete?: () => void;
  showInboxTime?: boolean;
  index?: number;
  // TODO(ts): higher order functions break defaultprops export types
} & Partial<typeof defaultProps>;

type State = {
  data: Group;
  reviewed: boolean;
};

class StreamGroup extends React.Component<Props, State> {
  static defaultProps = defaultProps;

  state: State = this.getInitialState();

  getInitialState(): State {
    const {id, useFilteredStats} = this.props;

    const data = GroupStore.get(id) as Group;

    return {
      data: {
        ...data,
        filtered: useFilteredStats ? data.filtered : null,
      },
      reviewed: false,
    };
  }

  componentWillReceiveProps(nextProps: Props) {
    if (
      nextProps.id !== this.props.id ||
      nextProps.useFilteredStats !== this.props.useFilteredStats
    ) {
      const data = GroupStore.get(this.props.id) as Group;

      this.setState({
        data: {
          ...data,
          filtered: nextProps.useFilteredStats ? data.filtered : null,
        },
      });
    }
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    if (nextProps.statsPeriod !== this.props.statsPeriod) {
      return true;
    }
    if (!valueIsEqual(this.state.data, nextState.data)) {
      return true;
    }
    return false;
  }

  componentWillUnmount() {
    callIfFunction(this.listener);
  }

  listener = GroupStore.listen(itemIds => this.onGroupChange(itemIds), undefined);

  onGroupChange(itemIds: Set<string>) {
    const {id, query} = this.props;
    if (!itemIds.has(id)) {
      return;
    }

    const data = GroupStore.get(id) as Group;
    this.setState(state => {
      // On the inbox tab and the inbox reason is removed
      const reviewed =
        state.reviewed ||
        (isForReviewQuery(query) &&
          (state.data.inbox as InboxDetails)?.reason !== undefined &&
          data.inbox === false);
      return {data, reviewed};
    });
  }

  /** Shared between two events */
  sharedAnalytics() {
    const {query, organization} = this.props;
    const {data} = this.state;
    const tab = getTabs(organization).find(([tabQuery]) => tabQuery === query)?.[1];
    const owners = data?.owners || [];
    return {
      organization_id: organization.id,
      group_id: data.id,
      tab: tab?.analyticsName || 'other',
      was_shown_suggestion: owners.length > 0,
    };
  }

  trackClick = () => {
    const {query, organization} = this.props;
    const {data} = this.state;
    if (isForReviewQuery(query)) {
      trackAnalyticsEvent({
        eventKey: 'inbox_tab.issue_clicked',
        eventName: 'Clicked Issue from Inbox Tab',
        organization_id: organization.id,
        group_id: data.id,
      });
    }

    if (query !== undefined) {
      trackAnalyticsEvent({
        eventKey: 'issues_stream.issue_clicked',
        eventName: 'Clicked Issue from Issues Stream',
        ...this.sharedAnalytics(),
      });
    }
  };

  trackAssign: React.ComponentProps<typeof AssigneeSelector>['onAssign'] = (
    type,
    _assignee,
    suggestedAssignee
  ) => {
    const {query} = this.props;
    if (query !== undefined) {
      trackAnalyticsEvent({
        eventKey: 'issues_stream.issue_assigned',
        eventName: 'Assigned Issue from Issues Stream',
        ...this.sharedAnalytics(),
        did_assign_suggestion: !!suggestedAssignee,
        assigned_suggestion_reason: suggestedAssignee?.suggestedReason,
        assigned_type: type,
      });
    }
  };

  toggleSelect = (evt: React.MouseEvent<HTMLDivElement>) => {
    const targetElement = evt.target as Partial<HTMLElement>;

    if (targetElement?.tagName?.toLowerCase() === 'a') {
      return;
    }

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

    SelectedGroupStore.toggleSelect(this.state.data.id);
  };

  getDiscoverUrl(isFiltered?: boolean) {
    const {organization, query, selection} = this.props;
    const {data} = this.state;

    // when there is no discover feature open events page
    const hasDiscoverQuery = organization.features.includes('discover-basic');

    const queryTerms: string[] = [];

    if (isFiltered && typeof query === 'string') {
      const queryObj = queryToObj(query);
      for (const queryTag in queryObj)
        if (!DiscoveryExclusionFields.includes(queryTag)) {
          const queryVal = queryObj[queryTag].includes(' ')
            ? `"${queryObj[queryTag]}"`
            : queryObj[queryTag];
          queryTerms.push(`${queryTag}:${queryVal}`);
        }

      if (queryObj.__text) {
        queryTerms.push(queryObj.__text);
      }
    }

    const commonQuery = {projects: [Number(data.project.id)]};

    const searchQuery = (queryTerms.length ? ' ' : '') + queryTerms.join(' ');

    if (hasDiscoverQuery) {
      const {period, start, end} = selection.datetime || {};

      const discoverQuery: NewQuery = {
        ...commonQuery,
        id: undefined,
        name: data.title || data.type,
        fields: ['title', 'release', 'environment', 'user', 'timestamp'],
        orderby: '-timestamp',
        query: `issue.id:${data.id}${searchQuery}`,
        version: 2,
      };

      if (!!start && !!end) {
        discoverQuery.start = String(start);
        discoverQuery.end = String(end);
      } else {
        discoverQuery.range = period || DEFAULT_STATS_PERIOD;
      }

      const discoverView = EventView.fromSavedQuery(discoverQuery);
      return discoverView.getResultsViewUrlTarget(organization.slug);
    }

    return {
      pathname: `/organizations/${organization.slug}/issues/${data.id}/events/`,
      query: {
        ...commonQuery,
        query: searchQuery,
      },
    };
  }

  renderReprocessingColumns() {
    const {data} = this.state;
    const {statusDetails, count} = data as GroupReprocessing;
    const {info, pendingEvents} = statusDetails;
    const {totalEvents, dateCreated} = info;

    const remainingEventsToReprocess = totalEvents - pendingEvents;
    const remainingEventsToReprocessPercent = percent(
      remainingEventsToReprocess,
      totalEvents
    );

    const value = remainingEventsToReprocessPercent || 100;

    return (
      <React.Fragment>
        <StartedColumn>
          <TimeSince date={dateCreated} />
        </StartedColumn>
        <EventsReprocessedColumn>
          {!defined(count) ? (
            <Placeholder height="17px" />
          ) : (
            <React.Fragment>
              <Count value={totalEvents} />
              {'/'}
              <Count value={Number(count)} />
            </React.Fragment>
          )}
        </EventsReprocessedColumn>
        <ProgressColumn>
          <ProgressBar value={value} />
        </ProgressColumn>
      </React.Fragment>
    );
  }

  render() {
    const {data, reviewed} = this.state;
    const {
      index,
      query,
      hasGuideAnchor,
      canSelect,
      memberList,
      withChart,
      statsPeriod,
      selection,
      organization,
      displayReprocessingLayout,
      showInboxTime,
      onMarkReviewed,
      useFilteredStats,
      onDelete,
    } = this.props;

    const {period, start, end} = selection.datetime || {};
    const summary =
      !!start && !!end
        ? 'time range'
        : getRelativeSummary(period || DEFAULT_STATS_PERIOD).toLowerCase();

    // Use data.filtered to decide on which value to use
    // In case of the query has filters but we avoid showing both sets of filtered/unfiltered stats
    // we use useFilteredStats param passed to Group for deciding
    const primaryCount = data.filtered ? data.filtered.count : data.count;
    const secondaryCount = data.filtered ? data.count : undefined;
    const primaryUserCount = data.filtered ? data.filtered.userCount : data.userCount;
    const secondaryUserCount = data.filtered ? data.userCount : undefined;

    const showSecondaryPoints = Boolean(
      withChart && data && data.filtered && statsPeriod && useFilteredStats
    );

    const hasInbox = organization.features.includes('inbox');

    return (
      <Wrapper
        data-test-id="group"
        onClick={displayReprocessingLayout ? undefined : this.toggleSelect}
        reviewed={reviewed}
        hasInbox={hasInbox}
      >
        {canSelect && (
          <GroupCheckBoxWrapper ml={2}>
            <GroupCheckBox id={data.id} disabled={!!displayReprocessingLayout} />
          </GroupCheckBoxWrapper>
        )}
        <GroupSummary
          width={[8 / 12, 8 / 12, 6 / 12]}
          ml={canSelect ? 1 : 2}
          mr={1}
          flex="1"
        >
          <EventOrGroupHeader
            index={index}
            organization={organization}
            includeLink
            data={data}
            query={query}
            size="normal"
            onClick={this.trackClick}
          />
          <EventOrGroupExtraDetails
            hasGuideAnchor={hasGuideAnchor}
            organization={organization}
            data={data}
            showInboxTime={showInboxTime}
          />
        </GroupSummary>
        {hasGuideAnchor && <GuideAnchor target="issue_stream" />}
        {withChart && !displayReprocessingLayout && (
          <ChartWrapper className="hidden-xs hidden-sm">
            {!data.filtered?.stats && !data.stats ? (
              <Placeholder height="24px" />
            ) : (
              <GroupChart
                statsPeriod={statsPeriod!}
                data={data}
                showSecondaryPoints={showSecondaryPoints}
              />
            )}
          </ChartWrapper>
        )}
        {displayReprocessingLayout ? (
          this.renderReprocessingColumns()
        ) : (
          <React.Fragment>
            <EventUserWrapper>
              {!defined(primaryCount) ? (
                <Placeholder height="18px" />
              ) : (
                <DropdownMenu isNestedDropdown>
                  {({isOpen, getRootProps, getActorProps, getMenuProps}) => {
                    const topLevelCx = classNames('dropdown', {
                      'anchor-middle': true,
                      open: isOpen,
                    });

                    return (
                      <GuideAnchor target="dynamic_counts" disabled={!hasGuideAnchor}>
                        <span
                          {...getRootProps({
                            className: topLevelCx,
                          })}
                        >
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
                              {data.filtered && (
                                <React.Fragment>
                                  <StyledMenuItem to={this.getDiscoverUrl(true)}>
                                    <MenuItemText>
                                      {t('Matching search filters')}
                                    </MenuItemText>
                                    <MenuItemCount value={data.filtered.count} />
                                  </StyledMenuItem>
                                  <MenuItem divider />
                                </React.Fragment>
                              )}

                              <StyledMenuItem to={this.getDiscoverUrl()}>
                                <MenuItemText>{t(`Total in ${summary}`)}</MenuItemText>
                                <MenuItemCount value={data.count} />
                              </StyledMenuItem>

                              {data.lifetime && (
                                <React.Fragment>
                                  <MenuItem divider />
                                  <StyledMenuItem>
                                    <MenuItemText>{t('Since issue began')}</MenuItemText>
                                    <MenuItemCount value={data.lifetime.count} />
                                  </StyledMenuItem>
                                </React.Fragment>
                              )}
                            </StyledDropdownList>
                          )}
                        </span>
                      </GuideAnchor>
                    );
                  }}
                </DropdownMenu>
              )}
            </EventUserWrapper>
            <EventUserWrapper>
              {!defined(primaryUserCount) ? (
                <Placeholder height="18px" />
              ) : (
                <DropdownMenu isNestedDropdown>
                  {({isOpen, getRootProps, getActorProps, getMenuProps}) => {
                    const topLevelCx = classNames('dropdown', {
                      'anchor-middle': true,
                      open: isOpen,
                    });

                    return (
                      <span
                        {...getRootProps({
                          className: topLevelCx,
                        })}
                      >
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
                            {data.filtered && (
                              <React.Fragment>
                                <StyledMenuItem to={this.getDiscoverUrl(true)}>
                                  <MenuItemText>
                                    {t('Matching search filters')}
                                  </MenuItemText>
                                  <MenuItemCount value={data.filtered.userCount} />
                                </StyledMenuItem>
                                <MenuItem divider />
                              </React.Fragment>
                            )}

                            <StyledMenuItem to={this.getDiscoverUrl()}>
                              <MenuItemText>{t(`Total in ${summary}`)}</MenuItemText>
                              <MenuItemCount value={data.userCount} />
                            </StyledMenuItem>

                            {data.lifetime && (
                              <React.Fragment>
                                <MenuItem divider />
                                <StyledMenuItem>
                                  <MenuItemText>{t('Since issue began')}</MenuItemText>
                                  <MenuItemCount value={data.lifetime.userCount} />
                                </StyledMenuItem>
                              </React.Fragment>
                            )}
                          </StyledDropdownList>
                        )}
                      </span>
                    );
                  }}
                </DropdownMenu>
              )}
            </EventUserWrapper>
            <AssigneeWrapper className="hidden-xs hidden-sm">
              <AssigneeSelector
                id={data.id}
                memberList={memberList}
                onAssign={this.trackAssign}
              />
            </AssigneeWrapper>
            {canSelect && hasInbox && (
              <ActionsWrapper>
                <GroupRowActions
                  group={data}
                  orgSlug={organization.slug}
                  selection={selection}
                  onDelete={onDelete}
                  onMarkReviewed={onMarkReviewed}
                  query={query}
                />
              </ActionsWrapper>
            )}
          </React.Fragment>
        )}
      </Wrapper>
    );
  }
}

export default withGlobalSelection(withOrganization(StreamGroup));

// Position for wrapper is relative for overlay actions
const Wrapper = styled(PanelItem)<{reviewed: boolean; hasInbox: boolean}>`
  position: relative;
  padding: ${p => (p.hasInbox ? `${space(1.5)} 0` : `${space(1)} 0`)};
  line-height: 1.1;

  ${p => (p.hasInbox ? p.theme.textColor : p.theme.subText)};

  ${p =>
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
        z-index: 1;
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

const GroupSummary = styled(Box)`
  overflow: hidden;
`;

const GroupCheckBoxWrapper = styled(Box)`
  align-self: flex-start;
  & input[type='checkbox'] {
    margin: 0;
    display: block;
  }
`;

const PrimaryCount = styled(Count)`
  font-size: ${p => p.theme.fontSizeLarge};
`;

const SecondaryCount = styled(({value, ...p}) => <Count {...p} value={value} />)`
  font-size: ${p => p.theme.fontSizeLarge};

  :before {
    content: '/';
    padding-left: ${space(0.25)};
    padding-right: 2px;
    color: ${p => p.theme.gray300};
  }
`;

const StyledDropdownList = styled('ul')`
  z-index: ${p => p.theme.zIndex.hovercard};
`;

const StyledMenuItem = styled(({to, children, ...p}) => (
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

const MenuItemCount = styled(({value, ...p}) => (
  <div {...p}>
    <Count value={value} />
  </div>
))`
  text-align: right;
  font-weight: bold;
  padding-left: ${space(1)};
`;

const MenuItemText = styled('div')`
  white-space: nowrap;
  font-weight: normal;
  text-align: left;
  padding-right: ${space(1)};
`;

const ChartWrapper = styled('div')`
  width: 160px;
  margin: 0 ${space(2)};
  align-self: center;
`;

const EventUserWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-self: center;
  width: 60px;
  margin: 0 ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    width: 80px;
  }
`;

const AssigneeWrapper = styled('div')`
  width: 80px;
  margin: 0 ${space(2)};
  align-self: center;
`;

const ActionsWrapper = styled('div')`
  width: 80px;
  margin: 0 ${space(2)};
  align-self: center;

  @media (max-width: ${p => p.theme.breakpoints[3]}) {
    display: none;
  }
`;

// Reprocessing
const StartedColumn = styled('div')`
  align-self: center;
  margin: 0 ${space(2)};
  color: ${p => p.theme.gray500};
  ${overflowEllipsis};
  width: 85px;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: block;
    width: 140px;
  }
`;

const EventsReprocessedColumn = styled('div')`
  align-self: center;
  margin: 0 ${space(2)};
  color: ${p => p.theme.gray500};
  ${overflowEllipsis};
  width: 75px;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    width: 140px;
  }
`;

const ProgressColumn = styled('div')`
  margin: 0 ${space(2)};
  align-self: center;
  display: none;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: block;
    width: 160px;
  }
`;
