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
import {IconTelescope} from 'app/icons';
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
import {DEFAULT_STATS_PERIOD} from 'app/constants';

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
    selection: SentryTypes.GlobalSelection,
  },

  mixins: [Reflux.listenTo(GroupStore, 'onGroupChange')],

  getDefaultProps() {
    return {
      id: '',
      statsPeriod: '24h',
      canSelect: true,
      withChart: true,
    };
  },

  getInitialState() {
    return {
      data: GroupStore.get(this.props.id),
      showLifetimeStats: false,
    };
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.id !== this.props.id) {
      this.setState({
        data: GroupStore.get(this.props.id),
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

    this.hoverWait = setTimeout(() => this.setState({showLifetimeStats}), 100);

    this.setState({showLifetimeStats});
    this.forceUpdate();
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
    } = this.props;

    const {period, start, end} = selection.datetime || {};

    const summary =
      !!start && !!end
        ? 'the selected period'
        : getRelativeSummary(period || DEFAULT_STATS_PERIOD).toLowerCase();

    return (
      <Group
        data-test-id="group"
        nClick={this.toggleSelect}
        onMouseEnter={() => this.toggleShowLifetimeStats(true)}
        onMouseLeave={() => this.toggleShowLifetimeStats(false)}
      >
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
            <GroupChart id={data.id} statsPeriod={statsPeriod} data={data} />
          </Box>
        )}
        <Flex width={[40, 60, 80, 80]} mx={2} justifyContent="flex-end">
          <Tooltip
            popperStyle={{background: theme.gray800, maxWidth: 'none'}}
            tipContent={
              <table style={{margin: 0}}>
                <tbody>
                  <tr style={{padding: '4px 8px', display: 'block'}}>
                    <td style={{fontWeight: 'normal'}}>Events since issue began</td>
                    <td style={{paddingLeft: '10px', fontWeight: 'bold'}}>
                      {data.lifetime.count}
                    </td>
                  </tr>
                  <tr style={{padding: '4px 8px', display: 'block'}}>
                    <td style={{fontWeight: 'normal'}}>Events within {summary}</td>
                    <td style={{paddingLeft: '10px', fontWeight: 'bold'}}>
                      {data.count}
                    </td>
                    <td style={{paddingLeft: '10px'}}>
                      <IconTelescope size="xs" color={theme.blue300} />
                    </td>
                  </tr>
                  <tr style={{padding: '4px 8px', display: 'block'}}>
                    <td style={{fontWeight: 'normal'}}>Events with filters applied</td>
                    <td style={{paddingLeft: '10px', fontWeight: 'bold'}}>
                      {data.filtered.count}
                    </td>
                    <td style={{paddingLeft: '10px'}}>
                      <IconTelescope size="xs" color={theme.blue300} />
                    </td>
                  </tr>
                </tbody>
              </table>
            }
          >
            <StyledPrimaryCount value={data.filtered.count} />
            {showLifetimeStats && (
              <React.Fragment>
                {'/'}
                <StyledSecondaryCount value={data.count} />
              </React.Fragment>
            )}
          </Tooltip>
        </Flex>
        <Flex width={[40, 60, 80, 80]} mx={2} justifyContent="flex-end">
          <Tooltip
            popperStyle={{background: theme.gray800, maxWidth: 'none'}}
            tipContent={
              <table style={{margin: 0}}>
                <tbody>
                  <tr style={{padding: '4px 8px', display: 'block'}}>
                    <td style={{fontWeight: 'normal'}}>
                      Users affected since issue began
                    </td>
                    <td style={{paddingLeft: '10px', fontWeight: 'bold'}}>
                      {data.lifetime.userCount}
                    </td>
                  </tr>
                  <tr style={{padding: '4px 8px', display: 'block'}}>
                    <td style={{fontWeight: 'normal'}}>
                      Users affected within {summary}
                    </td>
                    <td style={{paddingLeft: '10px', fontWeight: 'bold'}}>
                      {data.userCount}
                    </td>
                    <td style={{paddingLeft: '10px'}}>
                      <IconTelescope size="xs" color={theme.blue300} />
                    </td>
                  </tr>
                  <tr style={{padding: '4px 8px', display: 'block'}}>
                    <td style={{fontWeight: 'normal'}}>
                      Users affected with filters applied
                    </td>
                    <td style={{paddingLeft: '10px', fontWeight: 'bold'}}>
                      {data.filtered.userCount}
                    </td>
                    <td style={{paddingLeft: '10px'}}>
                      <IconTelescope size="xs" color={theme.blue300} />
                    </td>
                  </tr>
                </tbody>
              </table>
            }
          >
            <StyledPrimaryCount value={data.filtered.userCount} />
            {showLifetimeStats && (
              <React.Fragment>
                {'/'}
                <StyledSecondaryCount value={data.userCount} />
              </React.Fragment>
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

const StyledPrimaryCount = styled(Count)`
  font-size: 18px;
  color: ${p => p.theme.gray700};
`;

const StyledSecondaryCount = styled(Count)`
  font-size: 18px;
  color: ${p => p.theme.gray500};
`;

export default StreamGroup;
