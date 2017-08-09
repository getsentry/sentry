import React, {PropTypes} from 'react';
import Reflux from 'reflux';

import {t} from '../../locale';
import GroupingStore from '../../stores/groupingStore';

import LinkWithConfirmation from '../../components/linkWithConfirmation';
import SpreadLayout from '../../components/spreadLayout';
import SplitLayout from '../../components/splitLayout';

const MergedToolbar = React.createClass({
  propTypes: {
    onUnmerge: PropTypes.func
  },
  mixins: [Reflux.listenTo(GroupingStore, 'onGroupingUpdate')],
  getInitialState() {
    return {
      unmergeCount: 0
    };
  },

  onGroupingUpdate({unmergeList}) {
    if (unmergeList && unmergeList.size !== this.state.unmergedCount) {
      this.setState({
        unmergeCount: unmergeList.size
      });
    }
  },

  render() {
    let {onUnmerge} = this.props;
    return (
      <div className="grouping-toolbar stream-actions">
        <SplitLayout responsive>
          <SpreadLayout>
            <div className="stream-actions-header">
              {t('Event')}
            </div>
          </SpreadLayout>
          <SpreadLayout>
            <div className="stream-actions-header event-fingerprint-header">
              {t('Fingerprint')}
            </div>
            <div className="grouping-toolbar-actions">
              <LinkWithConfirmation
                disabled={this.state.unmergeCount === 0}
                title={t(`Unmerging ${this.state.unmergeCount} events`)}
                message={t(
                  'These events will be unmerged and grouped into a new issue. Are you sure you want to unmerge these events?'
                )}
                className="btn btn-sm btn-default"
                onConfirm={onUnmerge}>
                {t('Unmerge')} ({this.state.unmergeCount || 0})
              </LinkWithConfirmation>
            </div>
          </SpreadLayout>
        </SplitLayout>
      </div>
    );
  }
});

export default MergedToolbar;
