import React, {PropTypes} from 'react';
import Reflux from 'reflux';

import {t} from '../../locale';
import MergedEventsStore from '../../stores/mergedEventsStore';

import LinkWithConfirmation from '../../components/linkWithConfirmation';
import SpreadLayout from '../../components/spreadLayout';
import SplitLayout from '../../components/splitLayout';

const MergedToolbar = React.createClass({
  propTypes: {
    onUnmerge: PropTypes.func
  },
  mixins: [Reflux.listenTo(MergedEventsStore, 'onStoreUpdate')],
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
                disabled={!this.state.actionButtonEnabled || this.state.count === 0}
                title={t(`Unmerging ${this.state.count} events`)}
                message={t(
                  'These events will be unmerged and grouped into a new issue. Are you sure you want to unmerge these events?'
                )}
                className="btn btn-sm btn-default"
                onConfirm={onUnmerge}>
                {t('Unmerge')}
                {this.state.count ? ` (${this.state.count})` : null}
              </LinkWithConfirmation>
            </div>
          </SpreadLayout>
        </SplitLayout>
      </div>
    );
  }
});

export default MergedToolbar;
