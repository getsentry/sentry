import React, {PropTypes} from 'react';
import Reflux from 'reflux';

import {t} from '../../locale';
import GroupingStore from '../../stores/groupingStore';

import SpreadLayout from '../../components/spreadLayout';
import SplitLayout from '../../components/splitLayout';
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
      <div className="grouping-toolbar stream-actions">
        <SplitLayout responsive>
          <SpreadLayout>
            <div className="stream-actions-header">
              {t('Issue')}
            </div>
            <div className="stream-actions-header event-count-header">
              {t('Events')}
            </div>
          </SpreadLayout>

          <SpreadLayout>
            <div className="stream-actions-header event-similar-header">
              {t('Similarity Score')}
            </div>
            <div className="grouping-toolbar-actions">
              <LinkWithConfirmation
                disabled={this.state.mergeCount === 0}
                title={t(`Merging ${this.state.mergeCount} issues`)}
                message={t('Are you sure you want to merge these issues?')}
                className="btn btn-sm btn-default"
                onConfirm={onMerge}>
                {t('Merge')} ({this.state.mergeCount || 0})
              </LinkWithConfirmation>
            </div>
          </SpreadLayout>
        </SplitLayout>
      </div>
    );
  }
});

export default SimilarToolbar;
