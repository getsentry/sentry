import {Component, Fragment} from 'react';
import {css, Theme} from '@emotion/react';
import styled from '@emotion/styled';
import classNames from 'classnames';
import type {LocationDescriptor} from 'history';

import AssigneeSelector from 'sentry/components/assigneeSelector';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Count from 'sentry/components/count';
import DropdownMenu from 'sentry/components/dropdownMenu';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import Link from 'sentry/components/links/link';
import MenuItem from 'sentry/components/menuItem';
import {getRelativeSummary} from 'sentry/components/organizations/timeRangeSelector/utils';
import {PanelItem} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import ProgressBar from 'sentry/components/progressBar';
import GroupChart from 'sentry/components/stream/groupChart';
import GroupCheckBox from 'sentry/components/stream/groupCheckBox';
import TimeSince from 'sentry/components/timeSince';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import SelectedGroupStore from 'sentry/stores/selectedGroupStore';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {
  Group,
  GroupReprocessing,
  InboxDetails,
  NewQuery,
  Organization,
  PageFilters,
  User,
} from 'sentry/types';
import {defined, percent, valueIsEqual} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {callIfFunction} from 'sentry/utils/callIfFunction';
import EventView from 'sentry/utils/discover/eventView';
import {queryToObj} from 'sentry/utils/stream';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import {
  DISCOVER_EXCLUSION_FIELDS,
  getTabs,
  isForReviewQuery,
  Query,
} from 'sentry/views/issueList/utils';

export const DEFAULT_STREAM_GROUP_STATS_PERIOD = '24h';

const defaultProps = {
  statsPeriod: DEFAULT_STREAM_GROUP_STATS_PERIOD,
  canSelect: true,
  withChart: true,
  useFilteredStats: false,
  useTintRow: true,
  narrowGroups: false,
};

type Props = {
  id: string;
  organization: Organization;
  selection: PageFilters;
  customStatsPeriod?: TimePeriodType;
  displayReprocessingLayout?: boolean;
  hasGuideAnchor?: boolean;
  index?: number;
  memberList?: User[];
  query?: string;
  // TODO(ts): higher order functions break defaultprops export types
  queryFilterDescription?: string;
  showInboxTime?: boolean;
} & Partial<typeof defaultProps>;

type State = {
  actionTaken: boolean;
  data: Group;
  reviewed: boolean;
};

class StreamGroup extends Component<Props, State> {
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
      actionTaken: false,
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

    const actionTaken = this.state.data.status !== 'unresolved';
    const data = GroupStore.get(id) as Group;
    this.setState(state => {
      // When searching is:for_review and the inbox reason is removed
      const reviewed =
        state.reviewed ||
        (isForReviewQuery(query) &&
          (state.data.inbox as InboxDetails)?.reason !== undefined &&
          data.inbox === false);
      return {data, reviewed, actionTaken};
    });
  }

  /** Shared between two events */
  sharedAnalytics() {
    const {query, organization} = this.props;
    const {data} = this.state;
    const tab = getTabs(organization).find(([tabQuery]) => tabQuery === query)?.[1];
    const owners = data?.owners || [];
    return {
      organization,
      group_id: data.id,
      tab: tab?.analyticsName || 'other',
      was_shown_suggestion: owners.length > 0,
    };
  }

  trackClick = () => {
    const {query, organization} = this.props;
    const {data} = this.state;
    if (query === Query.FOR_REVIEW) {
      trackAdvancedAnalyticsEvent('inbox_tab.issue_clicked', {
        organization,
        group_id: data.id,
      });
    }

    if (query !== undefined) {
      trackAdvancedAnalyticsEvent('issues_stream.issue_clicked', this.sharedAnalytics());
    }
  };

  trackAssign: React.ComponentProps<typeof AssigneeSelector>['onAssign'] = (
    type,
    _assignee,
    suggestedAssignee
  ) => {
    const {query} = this.props;
    if (query !== undefined) {
      trackAdvancedAnalyticsEvent('issues_stream.issue_assigned', {
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

  getDiscoverUrl(isFiltered?: boolean): LocationDescriptor {
    const {organization, query, selection, customStatsPeriod} = this.props;
    const {data} = this.state;

    // when there is no discover feature open events page
    const hasDiscoverQuery = organization.features.includes('discover-basic');

    const queryTerms: string[] = [];

    if (isFiltered && typeof query === 'string') {
      const queryObj = queryToObj(query);
      for (const queryTag in queryObj) {
        if (!DISCOVER_EXCLUSION_FIELDS.includes(queryTag)) {
          const queryVal = queryObj[queryTag].includes(' ')
            ? `"${queryObj[queryTag]}"`
            : queryObj[queryTag];
          queryTerms.push(`${queryTag}:${queryVal}`);
        }
      }

      if (queryObj.__text) {
        queryTerms.push(queryObj.__text);
      }
    }

    const commonQuery = {projects: [Number(data.project.id)]};

    const searchQuery = (queryTerms.length ? ' ' : '') + queryTerms.join(' ');

    if (hasDiscoverQuery) {
      const {period, start, end, utc} = customStatsPeriod ?? (selection.datetime || {});

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
        discoverQuery.start = new Date(start).toISOString();
        discoverQuery.end = new Date(end).toISOString();
        if (utc) {
          discoverQuery.utc = true;
        }
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
  }

  render() {
    const {data, reviewed, actionTaken} = this.state;
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
      useFilteredStats,
      useTintRow,
      customStatsPeriod,
      queryFilterDescription,
      narrowGroups,
    } = this.props;

    const {period, start, end} = selection.datetime || {};
    const summary =
      customStatsPeriod?.label.toLowerCase() ??
      (!!start && !!end
        ? 'time range'
        : getRelativeSummary(period || DEFAULT_STATS_PERIOD).toLowerCase());

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

    return (
      <Wrapper
        data-test-id="group"
        onClick={displayReprocessingLayout ? undefined : this.toggleSelect}
        reviewed={reviewed}
        unresolved={data.status === 'unresolved'}
        actionTaken={actionTaken}
        useTintRow={useTintRow ?? true}
      >
        {canSelect && (
          <GroupCheckBoxWrapper>
            <GroupCheckBox id={data.id} disabled={!!displayReprocessingLayout} />
          </GroupCheckBoxWrapper>
        )}
        <GroupSummary canSelect={!!canSelect}>
          <EventOrGroupHeader
            index={index}
            organization={organization}
            includeLink
            data={data}
            query={query}
            size="normal"
            onClick={this.trackClick}
          />
          <EventOrGroupExtraDetails data={data} showInboxTime={showInboxTime} />
        </GroupSummary>
        {hasGuideAnchor && <GuideAnchor target="issue_stream" />}
        {withChart && !displayReprocessingLayout && (
          <ChartWrapper
            className={`hidden-xs hidden-sm ${narrowGroups ? 'hidden-md' : ''}`}
          >
            {!data.filtered?.stats && !data.stats ? (
              <Placeholder height="24px" />
            ) : (
              <GroupChart
                statsPeriod={statsPeriod!}
                data={data}
                showSecondaryPoints={showSecondaryPoints}
                showMarkLine
              />
            )}
          </ChartWrapper>
        )}
        {displayReprocessingLayout ? (
          this.renderReprocessingColumns()
        ) : (
          <Fragment>
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
                                <Fragment>
                                  <StyledMenuItem to={this.getDiscoverUrl(true)}>
                                    <MenuItemText>
                                      {queryFilterDescription ??
                                        t('Matching search filters')}
                                    </MenuItemText>
                                    <MenuItemCount value={data.filtered.count} />
                                  </StyledMenuItem>
                                  <MenuItem divider />
                                </Fragment>
                              )}

                              <StyledMenuItem to={this.getDiscoverUrl()}>
                                <MenuItemText>{t(`Total in ${summary}`)}</MenuItemText>
                                <MenuItemCount value={data.count} />
                              </StyledMenuItem>

                              {data.lifetime && (
                                <Fragment>
                                  <MenuItem divider />
                                  <StyledMenuItem>
                                    <MenuItemText>{t('Since issue began')}</MenuItemText>
                                    <MenuItemCount value={data.lifetime.count} />
                                  </StyledMenuItem>
                                </Fragment>
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
                              <Fragment>
                                <StyledMenuItem to={this.getDiscoverUrl(true)}>
                                  <MenuItemText>
                                    {queryFilterDescription ??
                                      t('Matching search filters')}
                                  </MenuItemText>
                                  <MenuItemCount value={data.filtered.userCount} />
                                </StyledMenuItem>
                                <MenuItem divider />
                              </Fragment>
                            )}

                            <StyledMenuItem to={this.getDiscoverUrl()}>
                              <MenuItemText>{t(`Total in ${summary}`)}</MenuItemText>
                              <MenuItemCount value={data.userCount} />
                            </StyledMenuItem>

                            {data.lifetime && (
                              <Fragment>
                                <MenuItem divider />
                                <StyledMenuItem>
                                  <MenuItemText>{t('Since issue began')}</MenuItemText>
                                  <MenuItemCount value={data.lifetime.userCount} />
                                </StyledMenuItem>
                              </Fragment>
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
          </Fragment>
        )}
      </Wrapper>
    );
  }
}

export default withPageFilters(withOrganization(StreamGroup));

// Position for wrapper is relative for overlay actions
const Wrapper = styled(PanelItem)<{
  actionTaken: boolean;
  reviewed: boolean;
  unresolved: boolean;
  useTintRow: boolean;
}>`
  position: relative;
  padding: ${space(1.5)} 0;
  line-height: 1.1;

  ${p =>
    p.useTintRow &&
    (p.reviewed || !p.unresolved) &&
    !p.actionTaken &&
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

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    width: 50%;
  }
`;

const GroupCheckBoxWrapper = styled('div')`
  margin-left: ${space(2)};
  align-self: flex-start;

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
