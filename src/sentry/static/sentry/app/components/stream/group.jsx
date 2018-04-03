import jQuery from 'jquery';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import styled from 'react-emotion';
import {Flex, Box} from 'grid-emotion';
import {capitalize} from 'lodash';

import AssigneeSelector from '../assigneeSelector';
import Count from '../count';
import GroupChart from './groupChart';
import GroupCheckBox from './groupCheckBox';
import ProjectState from '../../mixins/projectState';
import GroupStore from '../../stores/groupStore';
import GuideAnchor from '../../components/assistant/guideAnchor';
import SelectedGroupStore from '../../stores/selectedGroupStore';
import ShortId from '../shortId';
import EventOrGroupHeader from '../eventOrGroupHeader';
import EventOrGroupExtraDetails from '../eventOrGroupExtraDetails';
import TimeSince from '../timeSince';
import Tooltip from '../tooltip';
import {PanelItem} from '../panels';

import {t} from '../../locale';
import {valueIsEqual} from '../../utils';

const StreamGroup = createReactClass({
  displayName: 'StreamGroup',

  propTypes: {
    id: PropTypes.string.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    statsPeriod: PropTypes.string.isRequired,
    canSelect: PropTypes.bool,
    query: PropTypes.string,
    hasGuideAnchor: PropTypes.bool,
  },

  mixins: [Reflux.listenTo(GroupStore, 'onGroupChange'), ProjectState],

  getDefaultProps() {
    return {
      canSelect: true,
      id: '',
      statsPeriod: '24h',
    };
  },

  getInitialState() {
    return {
      data: GroupStore.get(this.props.id),
    };
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.id != this.props.id) {
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
    let id = this.props.id;
    let data = GroupStore.get(id);
    this.setState({
      data,
    });
  },

  toggleSelect(evt) {
    if (evt.target.tagName === 'A') return;
    if (evt.target.tagName === 'INPUT') return;
    if (jQuery(evt.target).parents('a').length !== 0) return;

    SelectedGroupStore.toggleSelect(this.state.data.id);
  },

  render() {
    const {data} = this.state;
    const {id, orgId, projectId, query, hasGuideAnchor} = this.props;

    return (
      <Group onClick={this.toggleSelect} py={1} px={0} align="center">
        <Tooltip title={`Error level: ${capitalize(data.level)}`}>
          <GroupLevel level={data.level} />
        </Tooltip>
        {this.props.canSelect && (
          <GroupCheckbox ml={1}>
            {hasGuideAnchor && <GuideAnchor target="issues" type="text" />}
            <GroupCheckBox id={data.id} />
          </GroupCheckbox>
        )}
        <GroupSummary w={[8 / 12, 8 / 12, 6 / 12]} mx={1} flex="1">
          <EventOrGroupHeader
            data={data}
            orgId={orgId}
            projectId={projectId}
            query={query}
          />
          <EventOrGroupExtraDetails
            group
            {...data}
            groupId={id}
            orgId={orgId}
            projectId={projectId}
          />
        </GroupSummary>
        <Box w={130} mx={2} className="hidden-xs">
          {data.shortId && <GroupShortId shortId={data.shortId} />}
          {data.firstSeen && (
            <GroupTimeSinceWrapper>
              {t('first seen')} <TimeSince date={data.firstSeen} suffix={t('ago')} />
            </GroupTimeSinceWrapper>
          )}
        </Box>
        <Box w={120} mx={2} className="hidden-xs hidden-sm">
          <GroupChart id={data.id} statsPeriod={this.props.statsPeriod} data={data} />
        </Box>
        <Flex w={50} mx={2} justify="flex-end">
          {hasGuideAnchor && <GuideAnchor target="events" type="text" />}
          <Count value={data.count} />
        </Flex>
        <Flex w={50} mx={2} justify="flex-end">
          {hasGuideAnchor && <GuideAnchor target="users" type="text" />}
          <Count value={data.userCount} />
        </Flex>
        <Box w={50} mx={2} className="hidden-xs hidden-sm">
          <StyledAssigneeSelector id={data.id} />
        </Box>
      </Group>
    );
  },
});

const Group = styled(PanelItem)`
  line-height: 1.1;
`;

const GroupSummary = styled(Box)`
  overflow: hidden;
`;

const GroupLevel = styled.div`
  margin-left: -1px;
  width: 9px;
  height: 15px;
  border-radius: 0 3px 3px 0;
  align-self: flex-start;

  background-color: ${p => {
    switch (p.level) {
      case 'sample':
        return p.theme.purple;
      case 'info':
        return p.theme.blue;
      case 'warning':
        return p.theme.yellowOrange;
      case 'error':
        return p.theme.orange;
      case 'fatal':
        return p.theme.red;
      default:
        return p.theme.gray2;
    }
  }};
`;

const GroupCheckbox = styled(Box)`
  align-self: flex-start;
  & input[type='checkbox'] {
    margin: 0;
    display: block;
  }
`;

const GroupTimeSinceWrapper = styled.span`
  font-size: 12px;
  color: ${p => p.theme.gray2};
`;

const GroupShortId = styled(ShortId)`
  display: inline;
  font-size: 15px;
  margin-bottom: 4px;
  }
`;

const StyledAssigneeSelector = styled(AssigneeSelector)`
  color: ${p => p.theme.gray1};
`;

export default StreamGroup;
