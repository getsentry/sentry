import React, {PropTypes} from 'react';
import Reflux from 'reflux';

import GroupingStore from '../../stores/groupingStore';
import GroupingActions from '../../actions/groupingActions';
import EventOrGroupHeader from '../../components/eventOrGroupHeader';
import EventOrGroupExtraDetails from '../../components/eventOrGroupExtraDetails';
import SpreadLayout from '../../components/spreadLayout';
import SplitLayout from '../../components/splitLayout';
import Checkbox from '../../components/checkbox';

const MergedItem = React.createClass({
  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    groupId: PropTypes.string.isRequired,
    fingerprint: PropTypes.string.isRequired,
    disabled: PropTypes.bool,
    event: PropTypes.shape({
      groupID: PropTypes.string,
      type: PropTypes.oneOf(['error', 'csp', 'default']),
      dateCreated: PropTypes.string,
      platform: PropTypes.string
    })
  },

  mixins: [Reflux.listenTo(GroupingStore, 'onGroupingUpdate')],

  getInitialState() {
    return {
      checked: false,
      locked: false,
      busy: false
    };
  },

  onGroupingUpdate({unmergeState}) {
    let {fingerprint} = this.props;
    if (unmergeState) {
      const stateForId = unmergeState.has(fingerprint) && unmergeState.get(fingerprint);
      if (stateForId) {
        Object.keys(stateForId).forEach(key => {
          if (stateForId[key] !== this.state[key]) {
            this.setState({
              [key]: stateForId[key]
            });
          }
        });
      }
    }
  },

  handleToggle(e) {
    let {disabled, fingerprint} = this.props;

    // clicking anywhere in the row will toggle the checkbox
    if (!disabled && !this.state.locked) {
      GroupingActions.toggleUnmerge(fingerprint);
    }
  },

  render() {
    let {disabled, event, orgId, fingerprint, projectId, groupId} = this.props;
    let checkboxDisabled = disabled || this.state.disabled || this.state.locked;

    // Not sure why, but `event` can be null
    return (
      <SplitLayout
        style={{
          opacity: this.state.busy || this.state.locked ? 0.6 : 1
        }}
        onClick={this.handleToggle}
        className="group merged-event"
        responsive>
        <div>
          <div className="event-details">
            {event &&
              <EventOrGroupHeader
                orgId={orgId}
                projectId={projectId}
                data={event}
                hideLevel
              />}
            {event &&
              <EventOrGroupExtraDetails
                groupId={groupId}
                orgId={orgId}
                projectId={projectId}
                event={event}
                firstSeen={event.dateCreated}
                logger={event.platform}
              />}
          </div>
        </div>

        <SpreadLayout className="grouping-controls">
          <div className="truncate fingerprint">
            {fingerprint}
          </div>
          <div className="align-right action-column">
            <Checkbox
              id={fingerprint}
              value={fingerprint}
              checked={this.state.checked}
              disabled={checkboxDisabled}
            />
          </div>
        </SpreadLayout>

      </SplitLayout>
    );
  }
});

export default MergedItem;
