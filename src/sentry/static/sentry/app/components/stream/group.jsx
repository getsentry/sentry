import {Flex, Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import jQuery from 'jquery';
import styled from 'react-emotion';

import {PanelItem} from 'app/components/panels';
import {valueIsEqual} from 'app/utils';
import AssigneeSelector from 'app/components/assigneeSelector';
import Count from 'app/components/count';
import EventOrGroupExtraDetails from 'app/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import GroupChart from 'app/components/stream/groupChart';
import GroupCheckBox from 'app/components/stream/groupCheckBox';
import GroupStore from 'app/stores/groupStore';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import ProjectState from 'app/mixins/projectState';
import SelectedGroupStore from 'app/stores/selectedGroupStore';

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
    const {id, orgId, projectId, query, hasGuideAnchor, canSelect} = this.props;

    return (
      <Group onClick={this.toggleSelect} py={1} px={0} align="center">
        {canSelect && (
          <GroupCheckbox ml={2}>
            {hasGuideAnchor && <GuideAnchor target="issues" type="text" />}
            <GroupCheckBox id={data.id} />
          </GroupCheckbox>
        )}
        <GroupSummary w={[8 / 12, 8 / 12, 6 / 12]} ml={canSelect ? 1 : 2} mr={1} flex="1">
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
        <Box w={160} mx={2} className="hidden-xs hidden-sm">
          <GroupChart id={data.id} statsPeriod={this.props.statsPeriod} data={data} />
        </Box>
        <Flex w={[40, 60, 80, 80]} mx={2} justify="flex-end">
          {hasGuideAnchor && <GuideAnchor target="events" type="text" />}
          <StyledCount value={data.count} />
        </Flex>
        <Flex w={[40, 60, 80, 80]} mx={2} justify="flex-end">
          {hasGuideAnchor && <GuideAnchor target="users" type="text" />}
          <StyledCount value={data.userCount} />
        </Flex>
        <Box w={80} mx={2} className="hidden-xs hidden-sm">
          <AssigneeSelector id={data.id} />
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

const GroupCheckbox = styled(Box)`
  align-self: flex-start;
  & input[type='checkbox'] {
    margin: 0;
    display: block;
  }
`;

const StyledCount = styled(Count)`
  font-size: 18px;
  color: ${p => p.theme.gray3};
`;

export default StreamGroup;
