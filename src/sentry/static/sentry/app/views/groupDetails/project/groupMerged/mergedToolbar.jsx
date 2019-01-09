import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import _ from 'lodash';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {openDiffModal} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import Button from 'app/components/button';
import GroupingStore from 'app/stores/groupingStore';
import LinkWithConfirmation from 'app/components/linkWithConfirmation';
import SpreadLayout from 'app/components/spreadLayout';
import Toolbar from 'app/components/toolbar';
import space from 'app/styles/space';

const MergedToolbar = createReactClass({
  displayName: 'MergedToolbar',

  propTypes: {
    onUnmerge: PropTypes.func,
    groupId: PropTypes.string,
    onToggleCollapse: PropTypes.func,
  },

  mixins: [Reflux.listenTo(GroupingStore, 'onGroupingUpdate')],

  getInitialState() {
    let {
      unmergeList,
      unmergeLastCollapsed,
      unmergeDisabled,
      enableFingerprintCompare,
    } = GroupingStore;

    return {
      enableFingerprintCompare,
      unmergeList,
      unmergeLastCollapsed,
      unmergeDisabled,
    };
  },

  onGroupingUpdate(updateObj) {
    let allowedKeys = [
      'unmergeLastCollapsed',
      'unmergeDisabled',
      'unmergeList',
      'enableFingerprintCompare',
    ];

    this.setState(_.pick(updateObj, allowedKeys));
  },

  handleShowDiff(e) {
    let {groupId} = this.props;
    let entries = this.state.unmergeList.entries();

    // `unmergeList` should only have 2 items in map
    if (this.state.unmergeList.size !== 2) return;

    // only need eventId, not fingerprint
    let [baseEventId, targetEventId] = Array.from(entries).map(([, eventId]) => eventId);

    openDiffModal({
      baseIssueId: groupId,
      targetIssueId: groupId,
      baseEventId,
      targetEventId,
    });

    e.stopPropagation();
  },

  render() {
    let {onUnmerge, onToggleCollapse} = this.props;
    let unmergeCount = (this.state.unmergeList && this.state.unmergeList.size) || 0;

    return (
      <StyledToolbar>
        <SpreadLayout>
          <SpreadLayout>
            <div>
              <LinkWithConfirmation
                disabled={this.state.unmergeDisabled}
                title={t(`Unmerging ${unmergeCount} events`)}
                message={t(
                  'These events will be unmerged and grouped into a new issue. Are you sure you want to unmerge these events?'
                )}
                className="btn btn-sm btn-default"
                onConfirm={onUnmerge}
              >
                {t('Unmerge')} ({unmergeCount || 0})
              </LinkWithConfirmation>

              <CompareButton
                size="small"
                disabled={!this.state.enableFingerprintCompare}
                onClick={this.handleShowDiff}
              >
                {t('Compare')}
              </CompareButton>
            </div>
          </SpreadLayout>
          <SpreadLayout>
            <div>
              <Button size="small" onClick={onToggleCollapse}>
                {this.state.unmergeLastCollapsed ? t('Expand All') : t('Collapse All')}
              </Button>
            </div>
          </SpreadLayout>
        </SpreadLayout>
      </StyledToolbar>
    );
  },
});

const CompareButton = styled(Button)`
  margin-left: ${space(1)};
`;

const StyledToolbar = styled(Toolbar)`
  padding: ${space(0.5)} ${space(1)};
`;

export default MergedToolbar;
