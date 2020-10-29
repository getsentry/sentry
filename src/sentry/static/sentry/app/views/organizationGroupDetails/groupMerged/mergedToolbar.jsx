import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import pick from 'lodash/pick';
import createReactClass from 'create-react-class';
import styled from '@emotion/styled';

import {openDiffModal} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import Button from 'app/components/button';
import GroupingStore from 'app/stores/groupingStore';
import LinkWithConfirmation from 'app/components/links/linkWithConfirmation';
import SpreadLayout from 'app/components/spreadLayout';
import Toolbar from 'app/components/toolbar';
import space from 'app/styles/space';
import SentryTypes from 'app/sentryTypes';

const MergedToolbar = createReactClass({
  displayName: 'MergedToolbar',

  propTypes: {
    orgId: PropTypes.string.isRequired,
    project: SentryTypes.Project.isRequired,
    groupId: PropTypes.string,
    onUnmerge: PropTypes.func,
    onToggleCollapse: PropTypes.func,
  },

  mixins: [Reflux.listenTo(GroupingStore, 'onGroupingUpdate')],

  getInitialState() {
    const {
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
    const allowedKeys = [
      'unmergeLastCollapsed',
      'unmergeDisabled',
      'unmergeList',
      'enableFingerprintCompare',
    ];

    this.setState(pick(updateObj, allowedKeys));
  },

  handleShowDiff(e) {
    const {groupId, project, orgId} = this.props;
    const entries = this.state.unmergeList.entries();

    // `unmergeList` should only have 2 items in map
    if (this.state.unmergeList.size !== 2) {
      return;
    }

    // only need eventId, not fingerprint
    const [baseEventId, targetEventId] = Array.from(entries).map(
      ([, eventId]) => eventId
    );

    openDiffModal({
      baseIssueId: groupId,
      targetIssueId: groupId,
      baseEventId,
      targetEventId,
      orgId,
      project,
    });

    e.stopPropagation();
  },

  render() {
    const {onUnmerge, onToggleCollapse} = this.props;
    const unmergeCount = (this.state.unmergeList && this.state.unmergeList.size) || 0;

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
