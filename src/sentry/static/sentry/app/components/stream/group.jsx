import jQuery from 'jquery';
import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';
import {withTheme} from 'theming';
import {Flex, Box} from 'grid-emotion';
import Reflux from 'reflux';

import AssigneeSelector from '../assigneeSelector';
import Count from '../count';
import GroupChart from './groupChart';
import GroupCheckBox from './groupCheckBox';
import ProjectState from '../../mixins/projectState';
import GroupStore from '../../stores/groupStore';
import SelectedGroupStore from '../../stores/selectedGroupStore';
import ShortId from '../shortId';
import EventOrGroupHeader from '../eventOrGroupHeader';
import EventOrGroupExtraDetails from '../eventOrGroupExtraDetails';
import TimeSince from '../timeSince';

import {valueIsEqual} from '../../utils';

const StreamGroup = React.createClass({
  propTypes: {
    id: PropTypes.string.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    statsPeriod: PropTypes.string.isRequired,
    canSelect: PropTypes.bool
  },

  mixins: [Reflux.listenTo(GroupStore, 'onGroupChange'), ProjectState],

  getDefaultProps() {
    return {
      canSelect: true,
      id: '',
      statsPeriod: '24h'
    };
  },

  getInitialState() {
    return {
      data: GroupStore.get(this.props.id)
    };
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.id != this.props.id) {
      this.setState({
        data: GroupStore.get(this.props.id)
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
    let id = this.props.id;
    let data = GroupStore.get(id);
    this.setState({
      data
    });
  },

  toggleSelect(evt) {
    if (evt.target.tagName === 'A') return;
    if (evt.target.tagName === 'INPUT') return;
    if (jQuery(evt.target).parents('a').length !== 0) return;

    SelectedGroupStore.toggleSelect(this.state.data.id);
  },

  render() {
    let data = this.state.data;
    let userCount = data.userCount;

    // TODO(ckj): Implement resolved and hasSeen state

    if (data.hasSeen) {
      className += ' hasSeen';
    }
    if (data.status === 'resolved') {
      className += ' isResolved';
    }

    let {id, orgId, projectId} = this.props;

    return (
      <StreamGroupRow onClick={this.toggleSelect} py={2}>
        <LevelIndicator level={data.level} />
        {this.props.canSelect &&
          <Checkbox w={40}>
            <GroupCheckBox id={data.id} />
          </Checkbox>}
        <Box
          w={[8 / 12, 8 / 12, 6 / 12]}
          px={[1, 2, 2, 2]}
          flex="1"
          style={{overflow: 'hidden'}}>
          <EventOrGroupHeader data={data} orgId={orgId} projectId={projectId} />
          <EventOrGroupExtraDetails
            group
            {...data}
            groupId={id}
            orgId={orgId}
            projectId={projectId}
          />
        </Box>
        <Box w={[100, 120, 160, 200]} px={(1, 2, 2, 3)}>
          {this.getFeatures().has('callsigns') &&
            data.shortId &&
            <GroupShortId shortId={data.shortId} />}
          {data.firstSeen &&
            <GroupTimeSinceWrapper>
              first seen <TimeSince date={data.firstSeen} suffix="ago" />
            </GroupTimeSinceWrapper>}
        </Box>
        <Box w={[100, 120, 160, 200]} px={(1, 2, 2, 3)}>
          <GroupChart id={data.id} statsPeriod={this.props.statsPeriod} data={data} />
        </Box>
        <Box w={(40, 40, 60, 70)} px={(1, 1, 2, 2)}>
          <Count value={data.count} />
        </Box>
        <Box w={(40, 40, 60, 70)} px={(1, 1, 2, 2)}>
          <Count value={userCount} />
        </Box>
        <Box w={(40, 60, 80, 80)} px={(1, 1, 2, 2)}>
          <AssigneeSelector id={data.id} />
        </Box>
      </StreamGroupRow>
    );
  }
});

const StreamGroupRow = withTheme(
  styled(Flex)`
    line-height: 1.1;
    font-size: 16px;
    position: relative;
    alignItems: center;
    border: 1px solid ${p => p.theme.borderDark};
    border-bottom: 1px solid ${p => p.theme.borderLight};

    & + & {
      margin-top: -1px;
    }

    &:first-child {
      border-top-left-radius: 3px;
      border-top-right-radius: 3px;
    }

    &:last-child {
      border-bottom-left-radius: 3px;
      border-bottom-right-radius: 3px;
      border-bottom: 1px solid ${p => p.theme.borderDark};
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.03);
    }
  `
);

const Checkbox = styled(Box)`
  padding-left: 24px;
  align-self: flex-start;
`;

const LevelIndicator = withTheme(
  styled.div`
    position: absolute;
    top: 18px;
    left: -1px;
    width: 9px;
    height: 18px;
    border-radius: 0 3px 3px 0;

    ${p => {
    switch (p.level) {
      case 'sample':
        return css`
          background-color: ${p.theme.purple};
        `;
      case 'info':
        return css`
          background-color: ${p.theme.blue};
        `;
      case 'warning':
        return css`
          background-color: ${p.theme.yellowOrange};
        `;
      case 'error':
        return css`
          background-color: ${p.theme.orange};
        `;
      case 'fatal':
        return css`
          background-color: ${p.theme.red};
        `;
    }
  }}
`
);

const GroupTimeSinceWrapper = withTheme(
  styled.span`
    font-size: 12px;
    color: ${p => p.theme.gray3};
  `
);

const GroupShortId = styled(ShortId)`
  display: block;
  font-size: 13px;
  margin-bottom: 4px;
`;

export default StreamGroup;
