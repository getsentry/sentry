import React, {PropTypes} from 'react';
import Reflux from 'reflux';
import classNames from 'classnames';

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

  mixins: [Reflux.listenTo(GroupingStore, 'onGroupingChange')],

  getInitialState() {
    return {
      checked: false,
      busy: false
    };
  },

  onGroupingChange({unmergeState}) {
    if (!unmergeState) return;

    let {fingerprint} = this.props;
    const stateForId = unmergeState.has(fingerprint) && unmergeState.get(fingerprint);
    if (!stateForId) return;

    Object.keys(stateForId).forEach(key => {
      if (stateForId[key] === this.state[key]) return;

      this.setState({
        [key]: stateForId[key]
      });
    });
  },

  handleToggle(e) {
    let {disabled, fingerprint} = this.props;

    if (disabled || this.state.busy) return;

    // clicking anywhere in the row will toggle the checkbox
    GroupingActions.toggleUnmerge(fingerprint);
  },

  render() {
    let {disabled, event, orgId, fingerprint, projectId, groupId} = this.props;
    let checkboxDisabled = disabled || this.state.disabled;
    let cx = classNames('group', 'merged-event', {
      busy: this.state.busy
    });

    // Not sure why, but `event` can be null
    return (
      <SplitLayout onClick={this.handleToggle} className={cx} responsive>
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
