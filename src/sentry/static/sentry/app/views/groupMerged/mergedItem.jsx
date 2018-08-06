import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import classNames from 'classnames';

import Checkbox from 'app/components/checkbox';
import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import FlowLayout from 'app/components/flowLayout';
import GroupingActions from 'app/actions/groupingActions';
import GroupingStore from 'app/stores/groupingStore';
import SpreadLayout from 'app/components/spreadLayout';

import 'app/../less/components/mergedItem.less';

const MergedItem = createReactClass({
  displayName: 'MergedItem',

  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    fingerprint: PropTypes.string.isRequired,
    disabled: PropTypes.bool,
    event: PropTypes.shape({
      groupID: PropTypes.string,
      type: PropTypes.oneOf(['error', 'csp', 'default']),
      dateCreated: PropTypes.string,
      platform: PropTypes.string,
    }),
  },

  mixins: [Reflux.listenTo(GroupingStore, 'onGroupingChange')],

  getInitialState() {
    return {
      collapsed: false,
      checked: false,
      busy: false,
    };
  },

  onGroupingChange({unmergeState}) {
    if (!unmergeState) return;

    let {fingerprint} = this.props;
    let stateForId = unmergeState.has(fingerprint) && unmergeState.get(fingerprint);
    if (!stateForId) return;

    Object.keys(stateForId).forEach(key => {
      if (stateForId[key] === this.state[key]) return;

      this.setState({
        [key]: stateForId[key],
      });
    });
  },

  handleToggleEvents() {
    let {fingerprint} = this.props;
    GroupingActions.toggleCollapseFingerprint(fingerprint);
  },

  // Disable default behavior of toggling checkbox
  handleLabelClick(e) {
    e.preventDefault();
  },

  handleToggle(e) {
    let {disabled, fingerprint, event} = this.props;

    if (disabled || this.state.busy) return;

    // clicking anywhere in the row will toggle the checkbox
    GroupingActions.toggleUnmerge([fingerprint, event.id]);
  },

  render() {
    let {disabled, event, orgId, fingerprint, projectId} = this.props;
    let checkboxDisabled = disabled || this.state.disabled;
    let cx = classNames('merged-group', {
      expanded: !this.state.collapsed,
      busy: this.state.busy,
    });

    // `event` can be null if last event w/ fingerprint is not within retention period
    return (
      <div className={cx}>
        <SpreadLayout className="merged-controls" responsive>
          <FlowLayout onClick={this.handleToggle}>
            <div className="action-column">
              <Checkbox
                id={fingerprint}
                value={fingerprint}
                checked={this.state.checked}
                disabled={checkboxDisabled}
              />
            </div>

            <label
              onClick={this.handleLabelClick}
              htmlFor={fingerprint}
              className="truncate fingerprint"
            >
              {fingerprint}
            </label>
          </FlowLayout>

          <div>
            <span />
            <span className="merged-collapse" onClick={this.handleToggleEvents}>
              {this.state.collapsed ? (
                <i className="icon-arrow-down" />
              ) : (
                <i className="icon-arrow-up" />
              )}
            </span>
          </div>
        </SpreadLayout>

        {!this.state.collapsed && (
          <div className="merged-events-list event-list">
            {event && (
              <SpreadLayout className="event-details" responsive>
                <FlowLayout>
                  <EventOrGroupHeader
                    orgId={orgId}
                    projectId={projectId}
                    data={event}
                    hideIcons
                    hideLevel
                  />
                </FlowLayout>
              </SpreadLayout>
            )}
          </div>
        )}
      </div>
    );
  },
});

export default MergedItem;
