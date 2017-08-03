import React, {PropTypes} from 'react';
import Reflux from 'reflux';

import {t} from '../../locale';
import SimilarIssuesStore from '../../stores/similarIssuesStore';

import SpreadLayout from '../../components/spreadLayout';
import SplitLayout from '../../components/splitLayout';
import LinkWithConfirmation from '../../components/linkWithConfirmation';

const SimilarToolbar = React.createClass({
  propTypes: {
    onMerge: PropTypes.func.isRequired
  },

  mixins: [Reflux.listenTo(SimilarIssuesStore, 'onStoreUpdate')],

  getInitialState() {
    return {
      count: 0
    };
  },

  onStoreUpdate({selectedSet, actionButtonEnabled}) {
    if (
      !selectedSet ||
      (actionButtonEnabled === this.state.actionButtonEnabled &&
        selectedSet.size === this.state.count)
    )
      return;

    this.setState({
      actionButtonEnabled,
      count: selectedSet.size
    });
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
                disabled={!this.state.actionButtonEnabled || this.state.count === 0}
                title={t(`Merging ${this.state.count} issues`)}
                message={t('Are you sure you want to merge these issues?')}
                className="btn btn-sm btn-default"
                onConfirm={onMerge}>
                {t('Merge')}
                {this.state.count ? ` (${this.state.count})` : null}
              </LinkWithConfirmation>
            </div>
          </SpreadLayout>
        </SplitLayout>
      </div>
    );
  }
});

export default SimilarToolbar;
