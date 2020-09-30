import $ from 'jquery';
// eslint-disable-next-line no-restricted-imports
import {Flex, Box} from 'reflexbox';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {PanelItem} from 'app/components/panels';
import {valueIsEqual} from 'app/utils';
import AssigneeSelector from 'app/components/assigneeSelector';
import Count from 'app/components/count';
import DropdownMenu from 'app/components/dropdownMenu';
import EventOrGroupExtraDetails from 'app/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import GroupChart from 'app/components/stream/groupChart';
import GroupCheckBox from 'app/components/stream/groupCheckBox';
import GroupStore from 'app/stores/groupStore';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import MenuItem from 'app/components/menuItem';
import SelectedGroupStore from 'app/stores/selectedGroupStore';
import space from 'app/styles/space';
import SentryTypes from 'app/sentryTypes';
import {getRelativeSummary} from 'app/components/organizations/timeRangeSelector/utils';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
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
    return false;
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

  getDiscoverUrl(filtered) {
    const {organization, query, selection} = this.props;
    const {data} = this.state;

    // TODO: @taylangocmen when there is no discover query open events page

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
    const {data} = this.state;
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

    const {period, start, end} = selection.datetime || {};
    const summary =
      !!start && !!end
        ? 'time range'
        : getRelativeSummary(period || DEFAULT_STATS_PERIOD).toLowerCase();

    const primaryCount =
      data.filtered && hasDynamicIssueCounts ? data.filtered.count : data.count;
    const secondaryCount =
      data.filtered && hasDynamicIssueCounts ? data.count : undefined;
    const primaryUserCount =
      data.filtered && hasDynamicIssueCounts ? data.filtered.userCount : data.userCount;
    const secondaryUserCount =
      data.filtered && hasDynamicIssueCounts ? data.userCount : undefined;

    const showSecondaryPoints = Boolean(
      withChart && data && data.filtered && hasDynamicIssueCounts && statsPeriod
    );

    return (
      <Group data-test-id="group" onClick={this.toggleSelect}>
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
          <EventOrGroupExtraDetails data={data} />
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
          <DropdownMenu isNestedDropdown>
            {({isOpen, getRootProps, getActorProps, getMenuProps}) => {
              const topLevelCx = classNames('dropdown', {
                'anchor-middle': true,
                open: isOpen && hasDynamicIssueCounts,
              });

              return (
                <span
                  {...getRootProps({
                    className: topLevelCx,
                  })}
                >
                  <span {...getActorProps({})}>
                    <div className="dropdown-actor-title">
                      <PrimaryCount
                        value={primaryCount}
                        filtered={secondaryCount !== undefined}
                      />
                      {secondaryCount !== undefined && (
                        <SecondaryCount value={secondaryCount} />
                      )}
                    </div>
                  </span>
                  <ul {...getMenuProps({className: 'dropdown-menu inverted'})}>
                    {data.filtered && (
                      <React.Fragment>
                        <StyledMenuItem to={this.getDiscoverUrl(true)}>
                          <MenuItemText>{t('Matching search filters')}</MenuItemText>
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
                  </ul>
                </span>
              );
            }}
          </DropdownMenu>
        </Flex>
        <Flex width={[40, 60, 80, 80]} mx={2} justifyContent="flex-end">
          <DropdownMenu isNestedDropdown>
            {({isOpen, getRootProps, getActorProps, getMenuProps}) => {
              const topLevelCx = classNames('dropdown', {
                'anchor-middle': true,
                open: isOpen && hasDynamicIssueCounts,
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
                      {secondaryUserCount !== undefined && (
                        <SecondaryCount dark value={secondaryUserCount} />
                      )}
                    </div>
                  </span>
                  <ul {...getMenuProps({className: 'dropdown-menu inverted'})}>
                    {data.filtered && (
                      <React.Fragment>
                        <StyledMenuItem to={this.getDiscoverUrl(true)}>
                          <MenuItemText>{t('Matching search filters')}</MenuItemText>
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
                  </ul>
                </span>
              );
            }}
          </DropdownMenu>
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
  color: ${p => (p.filtered ? p.theme.purple400 : p.theme.gray700)};
`;

const SecondaryCount = styled(({value, ...p}) => <Count {...p} value={value} />)`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  color: ${p => (p.dark ? p.theme.gray700 : p.theme.gray500)};

  :before {
    content: '/';
    color: ${p => p.theme.gray500};
  }
`;

const StyledMenuItem = styled(({to, children, ...p}) => (
  <MenuItem noAnchor>
    {to ? (
      <Link to={to}>
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

export default withGlobalSelection(withOrganization(StreamGroup));
