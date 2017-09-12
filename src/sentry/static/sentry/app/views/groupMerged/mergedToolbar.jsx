import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';

import {t} from '../../locale';
import GroupingStore from '../../stores/groupingStore';

import LinkWithConfirmation from '../../components/linkWithConfirmation';
import Toolbar from '../../components/toolbar';
import SpreadLayout from '../../components/spreadLayout';

const MergedToolbar = React.createClass({
  propTypes: {
    onUnmerge: PropTypes.func,
    onCollapse: PropTypes.func
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
    let {onUnmerge, onCollapse} = this.props;
    return (
      <Toolbar className="merged-toolbar">
        <SpreadLayout responsive>
          <SpreadLayout>
            <div className="merged-toolbar-actions">
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
          <SpreadLayout>
            <div>
              <button className="btn btn-sm btn-default" onClick={onCollapse}>
                Collapse All
              </button>
            </div>
          </SpreadLayout>
        </SpreadLayout>
      </Toolbar>
    );
  }
});

export default MergedToolbar;
