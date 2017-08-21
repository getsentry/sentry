import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import classNames from 'classnames';

import GroupingStore from '../../stores/groupingStore';
import GroupingActions from '../../actions/groupingActions';
import ProjectActions from '../../actions/projectActions';

import Count from '../../components/count';
import EventOrGroupHeader from '../../components/eventOrGroupHeader';
import EventOrGroupExtraDetails from '../../components/eventOrGroupExtraDetails';
import SpreadLayout from '../../components/spreadLayout';
import FlowLayout from '../../components/flowLayout';
import Checkbox from '../../components/checkbox';
import ScoreBar from '../../components/scoreBar';
import Hovercard from '../../components/hovercard';
import SimilarScoreCard from '../../components/similarScoreCard';

const similarInterfaces = ['exception', 'message'];

const SimilarIssueItem = React.createClass({
  propTypes: {
    orgId: PropTypes.string.isRequired,
    groupId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    score: PropTypes.object,
    scoresByInterface: PropTypes.shape({
      exception: PropTypes.array,
      message: PropTypes.array
    }),
    aggregate: PropTypes.shape({
      exception: PropTypes.number,
      message: PropTypes.number
    }),
    issue: PropTypes.shape({
      id: PropTypes.string.isRequired,
      level: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['error', 'csp', 'default']).isRequired,
      title: PropTypes.string.isRequired,
      metadata: PropTypes.shape({
        value: PropTypes.string,
        message: PropTypes.string,
        directive: PropTypes.string,
        type: PropTypes.string,
        title: PropTypes.string,
        uri: PropTypes.string
      }).isRequired,
      culprit: PropTypes.string,
      hideLevel: PropTypes.bool
    })
  },
  mixins: [Reflux.listenTo(GroupingStore, 'onGroupingUpdate')],

  getInitialState() {
    return {
      visible: true,
      checked: false,
      busy: false
    };
  },

  onGroupingUpdate({mergeState}) {
    let {issue} = this.props;
    if (mergeState) {
      const stateForId = mergeState.has(issue.id) && mergeState.get(issue.id);
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
    let {issue} = this.props;

    // clicking anywhere in the row will toggle the checkbox
    if (!this.state.busy) {
      GroupingActions.toggleMerge(issue.id);
    }
  },

  handleShowDiff(e) {
    let {groupId, issue} = this.props;
    ProjectActions.openDiffModal({
      baseIssueId: groupId,
      targetIssueId: issue.id
    });

    e.stopPropagation();
  },

  render() {
    let {aggregate, scoresByInterface, issue, orgId, projectId} = this.props;

    if (!this.state.visible) {
      return null;
    }

    let cx = classNames('group', 'similar-issue', {
      busy: this.state.busy
    });

    return (
      <SpreadLayout className={cx} responsive onClick={this.handleToggle}>
        <FlowLayout truncate>
          <FlowLayout truncate>
            <div className="action-column">
              <Checkbox id={issue.id} value={issue.id} checked={this.state.checked} />
            </div>
            <div className="event-details level-error" style={{flex: 1}}>
              <EventOrGroupHeader orgId={orgId} projectId={projectId} data={issue} />
              <EventOrGroupExtraDetails
                {...issue}
                groupId={issue.id}
                orgId={orgId}
                projectId={projectId}
                lastSeen={null}
                group
              />
            </div>
          </FlowLayout>
          <button
            style={{marginRight: 2}}
            className="btn btn-default btn-xs"
            onClick={this.handleShowDiff}>
            Diff
          </button>
        </FlowLayout>

        <div className="similar-score-columns">
          <Count className="similar-score-column" value={issue.count} />

          {similarInterfaces.map(interfaceName => {
            let avgScore = aggregate[interfaceName];
            let scoreList = scoresByInterface[interfaceName] || [];
            // Check for valid number (and not NaN)
            let scoreValue = typeof avgScore === 'number' && !Number.isNaN(avgScore)
              ? avgScore
              : 0;

            return (
              <div key={interfaceName} className="similar-score-column">
                <Hovercard
                  body={scoreList.length && <SimilarScoreCard scoreList={scoreList} />}>
                  <ScoreBar vertical score={Math.round(scoreValue * 5)} />
                </Hovercard>
              </div>
            );
          })}
        </div>
      </SpreadLayout>
    );
  }
});

export default SimilarIssueItem;
