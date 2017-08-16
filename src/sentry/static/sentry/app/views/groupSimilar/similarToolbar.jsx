import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';

import {t} from '../../locale';
import GroupingStore from '../../stores/groupingStore';

import SpreadLayout from '../../components/spreadLayout';
import FlowLayout from '../../components/flowLayout';
import LinkWithConfirmation from '../../components/linkWithConfirmation';

const SimilarToolbar = React.createClass({
  propTypes: {
    onMerge: PropTypes.func.isRequired
  },

  mixins: [Reflux.listenTo(GroupingStore, 'onGroupingUpdate')],

  getInitialState() {
    return {
      mergeCount: 0
    };
  },

  onGroupingUpdate({mergeList}) {
    if (mergeList && mergeList.size !== this.state.mergedCount) {
      this.setState({
        mergeCount: mergeList.size
      });
    }
  },

  render() {
    let {onMerge} = this.props;
    return (
      <SpreadLayout responsive className="similar-toolbar stream-actions">
        <FlowLayout style={{flex: 1}}>
          <FlowLayout>
            <div className="similar-toolbar-actions">
              <LinkWithConfirmation
                disabled={this.state.mergeCount === 0}
                title={t(`Merging ${this.state.mergeCount} issues`)}
                message={t('Are you sure you want to merge these issues?')}
                className="btn btn-sm btn-default"
                onConfirm={onMerge}>
                {t('Merge')} ({this.state.mergeCount || 0})
              </LinkWithConfirmation>
            </div>
          </FlowLayout>
        </FlowLayout>

        <div className="similar-score-columns">
          <div className="stream-actions-header similar-score-column event-count-header">
            {t('Events')}
          </div>
          <div className="stream-actions-header similar-score-column event-similar-header">
            {t('Exception')}
          </div>
          <div className="stream-actions-header similar-score-column event-similar-header">
            {t('Message')}
          </div>
        </div>
      </SpreadLayout>
    );
  }
});

export default SimilarToolbar;
