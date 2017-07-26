import React, {PropTypes} from 'react';
import Reflux from 'reflux';
import classNames from 'classnames';

import {t} from '../../locale';
import GroupingStore from '../../stores/groupingStore';
import GroupingActions from '../../actions/groupingActions';

import Count from '../../components/count';
import EventOrGroupHeader from '../../components/eventOrGroupHeader';
import EventOrGroupExtraDetails from '../../components/eventOrGroupExtraDetails';
import SpreadLayout from '../../components/spreadLayout';
import SplitLayout from '../../components/splitLayout';
import Checkbox from '../../components/checkbox';

// TODO(billy): Replace this with a quantified aggregate score
const scoreComponents = {
  'exception:message:character-shingles': t('Exception'),
  'exception:stacktrace:application-chunks': t('App code'),
  'exception:stacktrace:pairs': t('Stacktrace'),
  'message:message:character-shingles': t('Message')
};

const SimilarIssueItem = React.createClass({
  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    score: PropTypes.object,
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

  displaySimilarity(value) {
    return isNaN(value) ? '' : `${Math.round(value * 100)}%`;
  },

  handleToggle(e) {
    let {issue} = this.props;

    // clicking anywhere in the row will toggle the checkbox
    if (!this.state.busy) {
      GroupingActions.toggleMerge(issue.id);
    }
  },

  render() {
    let {score, issue, orgId, projectId} = this.props;

    if (!this.state.visible) {
      return null;
    }

    let cx = classNames('group', 'similar-issue', {
      busy: this.state.busy
    });

    return (
      <SplitLayout className={cx} responsive onClick={this.handleToggle}>
        <SpreadLayout>
          <div className="event-details">
            <EventOrGroupHeader
              orgId={orgId}
              projectId={projectId}
              data={issue}
              hideLevel
            />
            <EventOrGroupExtraDetails
              {...issue}
              groupId={issue.id}
              orgId={orgId}
              projectId={projectId}
              group
            />
          </div>

          <Count className="event-count" value={issue.count} />
        </SpreadLayout>

        <SpreadLayout>
          <div className="similarity-score">
            {Object.keys(score).map(scoreKey => {
              const color = `hsl(${score[scoreKey] * 100},40%,50%)`;
              return (
                <div key={scoreKey} className="similarity-score-row">
                  <div className="similarity-score-label">
                    <span>
                      {scoreComponents[scoreKey]}
                    </span>
                    <span
                      style={{
                        fontWeight: 'bold',
                        color
                      }}>
                      {this.displaySimilarity(score[scoreKey])}
                    </span>
                  </div>
                  <div
                    className="similarity-score-bar"
                    style={{
                      width: `${Math.round(score[scoreKey] * 100)}%`,
                      backgroundColor: color
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div className="action-column">
            <Checkbox id={issue.id} value={issue.id} checked={this.state.checked} />
          </div>
        </SpreadLayout>
      </SplitLayout>
    );
  }
});

export default SimilarIssueItem;
