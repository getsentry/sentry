import $ from 'jquery';
// eslint-disable-next-line no-restricted-imports
import {Flex, Box} from 'reflexbox';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from '@emotion/styled';

import {PanelItem} from 'app/components/panels';
import {valueIsEqual} from 'app/utils';
import theme from 'app/utils/theme';
import {IconOpen} from 'app/icons';
import AssigneeSelector from 'app/components/assigneeSelector';
import Count from 'app/components/count';
import EventOrGroupExtraDetails from 'app/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import GroupChart from 'app/components/stream/groupChart';
import GroupCheckBox from 'app/components/stream/groupCheckBox';
import GroupStore from 'app/stores/groupStore';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import SelectedGroupStore from 'app/stores/selectedGroupStore';
import space from 'app/styles/space';
import Tooltip from 'app/components/tooltip';
import SentryTypes from 'app/sentryTypes';
import {getRelativeSummary} from 'app/components/organizations/timeRangeSelector/utils';
import {DEFAULT_STATS_PERIOD, MENU_CLOSE_DELAY} from 'app/constants';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import EventView from 'app/utils/discover/eventView';
import {t} from 'app/locale';
import Link from 'app/components/links/link';
import {queryToObj} from 'app/utils/stream';

const StreamGroup = createReactClass({
  displayName: 'StreamGroup',

  propTypes: {
    id: PropTypes.string.isRequired,
    statsPeriod: PropTypes.string.isRequired,
    canSelect: PropTypes.bool,
    query: PropTypes.string,
    hasGuideAnchor: PropTypes.bool,
    memberList: PropTypes.array,
    withChart: PropTypes.bool,
    selection: SentryTypes.GlobalSelection.isRequired,
    organization: SentryTypes.Organization.isRequired,
    useFilteredStats: PropTypes.bool,
  },

  mixins: [Reflux.listenTo(GroupStore, 'onGroupChange')],

  getDefaultProps() {
    return {
      id: '',
      statsPeriod: '24h',
      canSelect: true,
      withChart: true,
      useFilteredStats: false,
    };
  },

  getInitialState() {
    const data = GroupStore.get(this.props.id);

    return {
      data: {
        ...data,
        filtered: this.props.useFilteredStats ? data.filtered : undefined,
      },
      showLifetimeStats: false,
    };
  },

  componentWillReceiveProps(nextProps) {
    if (
      nextProps.id !== this.props.id ||
      nextProps.useFilteredStats !== this.props.useFilteredStats
    ) {
      const data = GroupStore.get(this.props.id);

      this.setState({
        data: {
          ...data,
          filtered: nextProps.useFilteredStats ? data.filtered : undefined,
        },
      });
    }
  },

  shouldComponentUpdate(nextProps, nextState) {
    if (nextProps.statsPeriod !== this.props.statsPeriod) {
      return true;
    }
    if (!valueIsEqual(this.state.data, nextState.data)) {
      return true;
    }
    return this.state.showLifetimeStats !== nextState.showLifetimeStats;
  },

  componentWillUnmount() {
    clearTimeout(this.hoverWait);
  },

  onGroupChange(itemIds) {
    if (!itemIds.has(this.props.id)) {
      return;
    }
    const id = this.props.id;
    const data = GroupStore.get(id);
    this.setState({
      data,
    });
  },

  toggleSelect(evt) {
    if (evt.target.tagName === 'A') {
      return;
    }
    if (evt.target.tagName === 'INPUT') {
      return;
    }
    if ($(evt.target).parents('a').length !== 0) {
      return;
    }

    SelectedGroupStore.toggleSelect(this.state.data.id);
  },

  toggleShowLifetimeStats(showLifetimeStats) {
    if (this.hoverWait) {
      clearTimeout(this.hoverWait);
    }

    this.hoverWait = setTimeout(
      () => this.setState({showLifetimeStats}),
      MENU_CLOSE_DELAY
    );

    this.setState({showLifetimeStats});
  },

  getDiscoverUrl(filtered) {
    const {organization, query, selection} = this.props;
    const {data} = this.state;

    const {period, start, end} = selection.datetime || {};

    const discoveryQueryTerms = [];

    if (filtered && query) {
      const queryObj = queryToObj(query);
      for (const queryTag in queryObj)
        if (!['is', '__text'].includes(queryTag)) {
          const queryVal = queryObj[queryTag].includes(' ')
            ? `"${queryObj[queryTag]}"`
            : queryObj[queryTag];
          discoveryQueryTerms.push(`${queryTag}:${queryVal}`);
        }
    }

    const additionalQuery =
      (discoveryQueryTerms.length ? ' ' : '') + discoveryQueryTerms.join(' ');

    const discoverQuery = {
      id: undefined,
      name: data.title || data.type,
      fields: ['title', 'release', 'environment', 'user', 'timestamp'],
      orderby: '-timestamp',
      query: `issue.id:${data.id}${additionalQuery}`,
      projects: [data.project.id],
      version: 2,
    };

    if (!!start && !!end) {
      discoverQuery.start = start;
      discoverQuery.end = end;
    } else {
      discoverQuery.range = period || DEFAULT_STATS_PERIOD;
    }

    const discoverView = EventView.fromSavedQuery(discoverQuery);
    return discoverView.getResultsViewUrlTarget(organization.slug);
  },

  render() {
    const {data, showLifetimeStats} = this.state;
    const {
      query,
      hasGuideAnchor,
      canSelect,
      memberList,
      withChart,
      statsPeriod,
      selection,
      organization,
    } = this.props;

    const hasDynamicIssueCounts = organization.features.includes('dynamic-issue-counts');
    const hasDiscoverQuery = organization.features.includes('discover-basic');

    const {period, start, end} = selection.datetime || {};
    const summary =
      !!start && !!end
        ? 'the selected period'
        : getRelativeSummary(period || DEFAULT_STATS_PERIOD).toLowerCase();

    const popperStyle = {maxWidth: 'none'};

    const primaryCount =
      data.filtered && hasDynamicIssueCounts ? data.filtered.count : data.count;
    const secondaryCount =
      data.filtered && hasDynamicIssueCounts ? data.count : undefined;
    const primaryUserCount =
      data.filtered && hasDynamicIssueCounts ? data.filtered.userCount : data.userCount;
    const secondaryUserCount =
      data.filtered && hasDynamicIssueCounts ? data.userCount : undefined;

    const mouseEventHandlers = hasDynamicIssueCounts
      ? {
          onMouseEnter: () => this.toggleShowLifetimeStats(true),
          onMouseLeave: () => this.toggleShowLifetimeStats(false),
        }
      : {};

    // TODO: @taylangocmen discover links on telescopes
    // TODO: @taylangocmen sort rows when clicked on a column
    // TODO: @taylangocmen onboarding callouts when for when feature ships

    const showSecondaryPoints = Boolean(
      showLifetimeStats &&
        withChart &&
        data &&
        data.filtered &&
        hasDynamicIssueCounts &&
        statsPeriod
    );

    return (
      <Group data-test-id="group" onClick={this.toggleSelect} {...mouseEventHandlers}>
        {canSelect && (
          <GroupCheckbox ml={2}>
            <GroupCheckBox id={data.id} />
          </GroupCheckbox>
        )}
        <GroupSummary
          width={[8 / 12, 8 / 12, 6 / 12]}
          ml={canSelect ? 1 : 2}
          mr={1}
          flex="1"
        >
          <EventOrGroupHeader data={data} query={query} />
          <EventOrGroupExtraDetails {...data} />
        </GroupSummary>
        {hasGuideAnchor && <GuideAnchor target="issue_stream" />}
        {withChart && (
          <Box width={160} mx={2} className="hidden-xs hidden-sm">
            <GroupChart
              statsPeriod={statsPeriod}
              data={data}
              hasDynamicIssueCounts={hasDynamicIssueCounts}
              showSecondaryPoints={showSecondaryPoints}
            />
          </Box>
        )}
        <Flex width={[40, 60, 80, 80]} mx={2} justifyContent="flex-end">
          <Tooltip
            disabled={!hasDynamicIssueCounts}
            popperStyle={popperStyle}
            isHoverable
            title={
              <TooltipContent>
                {data.filtered && (
                  <tr>
                    <TooltipCount value={data.filtered.count} />
                    <TooltipText>{t('Matching search filters')}</TooltipText>
                    {hasDiscoverQuery && (
                      <StyledIconOpen
                        to={this.getDiscoverUrl(true)}
                        color={theme.blue300}
                      />
                    )}
                  </tr>
                )}
                <tr>
                  <TooltipCount value={data.count} />
                  <TooltipText>
                    {data.filtered ? t(`Without search filters`) : t(`In ${summary}`)}
                  </TooltipText>
                  {hasDiscoverQuery && (
                    <StyledIconOpen to={this.getDiscoverUrl()} color={theme.blue300} />
                  )}
                </tr>
                {data.lifetime && (
                  <tr>
                    <TooltipCount value={data.lifetime.count} />
                    <TooltipText>{t('Since issue began')}</TooltipText>
                  </tr>
                )}
              </TooltipContent>
            }
          >
            <PrimaryCount value={primaryCount} />
            {showLifetimeStats && secondaryCount !== undefined && (
              <SecondaryCount value={secondaryCount} />
            )}
          </Tooltip>
        </Flex>
        <Flex width={[40, 60, 80, 80]} mx={2} justifyContent="flex-end">
          <Tooltip
            disabled={!hasDynamicIssueCounts}
            popperStyle={popperStyle}
            isHoverable
            title={
              <TooltipContent>
                {data.filtered && (
                  <tr>
                    <TooltipCount value={data.filtered.userCount} />
                    <TooltipText>{t('Matching search filters')}</TooltipText>
                    {hasDiscoverQuery && (
                      <StyledIconOpen
                        to={this.getDiscoverUrl(true)}
                        color={theme.blue300}
                      />
                    )}
                  </tr>
                )}
                <tr>
                  <TooltipCount value={data.userCount} />
                  <TooltipText>
                    {data.filtered ? t(`Without search filters`) : t(`In ${summary}`)}
                  </TooltipText>
                  {hasDiscoverQuery && (
                    <StyledIconOpen to={this.getDiscoverUrl()} color={theme.blue300} />
                  )}
                </tr>
                {data.lifetime && (
                  <tr>
                    <TooltipCount value={data.lifetime.userCount} />
                    <TooltipText>{t('Since issue began')}</TooltipText>
                  </tr>
                )}
              </TooltipContent>
            }
          >
            <PrimaryCount value={primaryUserCount} />
            {showLifetimeStats && secondaryUserCount !== undefined && (
              <SecondaryCount value={secondaryUserCount} />
            )}
          </Tooltip>
        </Flex>
        <Box width={80} mx={2} className="hidden-xs hidden-sm">
          <AssigneeSelector id={data.id} memberList={memberList} />
        </Box>
      </Group>
    );
  },
});

const Group = styled(PanelItem)`
  padding: ${space(1)} 0;
  align-items: center;
  line-height: 1.1;
`;

const GroupSummary = styled(Box)`
  overflow: hidden;
`;

const GroupCheckbox = styled(Box)`
  align-self: flex-start;
  & input[type='checkbox'] {
    margin: 0;
    display: block;
  }
`;

const PrimaryCount = styled(Count)`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  color: ${p => p.theme.gray700};
`;

const SecondaryCount = styled(({value, ...p}) => <Count {...p} value={value} />)`
  position: absolute;
  font-size: ${p => p.theme.fontSizeExtraLarge};
  color: ${p => p.theme.gray500};

  :before {
    content: '/';
  }
`;

const TooltipContent = styled(({children, ...p}) => (
  <table {...p}>
    <tbody>{children}</tbody>
  </table>
))`
  margin: 0;
`;

const TooltipCount = styled(({value, ...p}) => (
  <td {...p}>
    <Count value={value} />
  </td>
))`
  text-align: right;
  font-weight: bold;
  padding: ${space(0.5)};
`;

const TooltipText = styled('td')`
  font-weight: normal;
  text-align: left;
  padding: ${space(0.5)} ${space(1)};
`;

const StyledIconOpen = styled(({to, ...p}) => (
  <td {...p}>
    <Link title={t('Open in Discover')} to={to} target="_blank">
      <IconOpen size="xs" color={p.color} />
    </Link>
  </td>
))`
  padding: ${space(0.5)};
`;

export default withGlobalSelection(withOrganization(StreamGroup));
