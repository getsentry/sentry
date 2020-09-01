import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import classNames from 'classnames';
import createReactClass from 'create-react-class';

import SentryTypes from 'app/sentryTypes';
import {openDiffModal} from 'app/actionCreators/modal';
import Checkbox from 'app/components/checkbox';
import Count from 'app/components/count';
import EventOrGroupExtraDetails from 'app/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import FlowLayout from 'app/components/flowLayout';
import GroupingActions from 'app/actions/groupingActions';
import GroupingStore from 'app/stores/groupingStore';
import Hovercard from 'app/components/hovercard';
import ScoreBar from 'app/components/scoreBar';
import SimilarScoreCard from 'app/components/similarScoreCard';
import SpreadLayout from 'app/components/spreadLayout';

const similarInterfaces = ['exception', 'message'];

const Item = createReactClass({
  displayName: 'SimilarIssueItem',

  propTypes: {
    orgId: PropTypes.string.isRequired,
    groupId: PropTypes.string.isRequired,
    score: PropTypes.object,
    scoresByInterface: PropTypes.shape({
      exception: PropTypes.array,
      message: PropTypes.array,
    }),
    aggregate: PropTypes.shape({
      exception: PropTypes.number,
      message: PropTypes.number,
    }),
    issue: SentryTypes.Group.isRequired,
  },

  mixins: [Reflux.listenTo(GroupingStore, 'onGroupingUpdate')],

  getInitialState() {
    return {
      visible: true,
      checked: false,
      busy: false,
    };
  },

  onGroupingUpdate({mergeState}) {
    const {issue} = this.props;
    if (mergeState) {
      const stateForId = mergeState.has(issue.id) && mergeState.get(issue.id);
      if (stateForId) {
        Object.keys(stateForId).forEach(key => {
          if (stateForId[key] !== this.state[key]) {
            this.setState({
              [key]: stateForId[key],
            });
          }
        });
      }
    }
  },

  handleToggle() {
    const {issue} = this.props;

    // clicking anywhere in the row will toggle the checkbox
    if (!this.state.busy) {
      GroupingActions.toggleMerge(issue.id);
    }
  },

  handleShowDiff(e) {
    const {orgId, groupId, issue} = this.props;
    openDiffModal({
      baseIssueId: groupId,
      targetIssueId: issue.id,
      projectId: issue.project.slug,
      orgId,
    });

    e.stopPropagation();
  },

  handleCheckClick() {
    // noop to appease React warnings
    // This is controlled via row click instead of only Checkbox
  },

  render() {
    const {aggregate, scoresByInterface, issue} = this.props;

    if (!this.state.visible) {
      return null;
    }

    const cx = classNames('group', 'similar-issue', {
      isResolved: issue.status === 'resolved',
      busy: this.state.busy,
    });

    return (
      <SpreadLayout
        data-test-id="similar-item-row"
        className={cx}
        responsive
        onClick={this.handleToggle}
      >
        <FlowLayout truncate>
          <FlowLayout truncate>
            <div className="action-column">
              <Checkbox
                id={issue.id}
                value={issue.id}
                checked={this.state.checked}
                onChange={this.handleCheckClick}
              />
            </div>
            <div className="event-details" style={{flex: 1}}>
              <EventOrGroupHeader data={issue} />
              <EventOrGroupExtraDetails {...issue} lastSeen={null} showAssignee />
            </div>
          </FlowLayout>
          <button
            style={{marginRight: 2}}
            className="btn btn-default btn-xs"
            onClick={this.handleShowDiff}
          >
            Diff
          </button>
        </FlowLayout>

        <div className="similar-score-columns">
          <Count className="similar-score-column" value={issue.count} />

          {similarInterfaces.map(interfaceName => {
            const avgScore = aggregate[interfaceName];
            const scoreList = scoresByInterface[interfaceName] || [];
            // Check for valid number (and not NaN)
            const scoreValue =
              typeof avgScore === 'number' && !Number.isNaN(avgScore) ? avgScore : 0;

            return (
              <div key={interfaceName} className="similar-score-column">
                <Hovercard
                  body={scoreList.length && <SimilarScoreCard scoreList={scoreList} />}
                >
                  <ScoreBar vertical score={Math.round(scoreValue * 5)} />
                </Hovercard>
              </div>
            );
          })}
        </div>
      </SpreadLayout>
    );
  },
});

export default Item;
