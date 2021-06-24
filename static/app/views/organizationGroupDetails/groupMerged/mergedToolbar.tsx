import * as React from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {openDiffModal} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {PanelHeader} from 'app/components/panels';
import {t, tct} from 'app/locale';
import GroupingStore from 'app/stores/groupingStore';
import space from 'app/styles/space';
import {Group, Organization, Project} from 'app/types';

type Props = {
  orgId: Organization['slug'];
  project: Project;
  groupId: Group['id'];
  onUnmerge: () => void;
  onToggleCollapse: () => void;
};

type State = {
  unmergeList: Map<any, any>;
  unmergeLastCollapsed: boolean;
  unmergeDisabled: boolean;
  enableFingerprintCompare: boolean;
};

class MergedToolbar extends React.Component<Props, State> {
  state: State = this.getInitialState();

  getInitialState() {
    const {unmergeList, unmergeLastCollapsed, unmergeDisabled, enableFingerprintCompare} =
      GroupingStore;

    return {
      enableFingerprintCompare,
      unmergeList,
      unmergeLastCollapsed,
      unmergeDisabled,
    };
  }

  componentWillUnmount() {
    this.listener?.();
  }

  listener = GroupingStore.listen(data => this.onGroupChange(data), undefined);

  onGroupChange = updateObj => {
    const allowedKeys = [
      'unmergeLastCollapsed',
      'unmergeDisabled',
      'unmergeList',
      'enableFingerprintCompare',
    ];

    this.setState(pick(updateObj, allowedKeys));
  };

  handleShowDiff = (event: React.MouseEvent) => {
    const {groupId, project, orgId} = this.props;
    const {unmergeList} = this.state;

    const entries = unmergeList.entries();

    // `unmergeList` should only have 2 items in map
    if (unmergeList.size !== 2) {
      return;
    }

    // only need eventId, not fingerprint
    const [baseEventId, targetEventId] = Array.from(entries).map(
      ([, eventId]) => eventId
    );

    openDiffModal({
      targetIssueId: groupId,
      project,
      baseIssueId: groupId,
      orgId,
      baseEventId,
      targetEventId,
    });

    event.stopPropagation();
  };

  render() {
    const {onUnmerge, onToggleCollapse} = this.props;

    const {unmergeList, unmergeLastCollapsed, unmergeDisabled, enableFingerprintCompare} =
      this.state;
    const unmergeCount = (unmergeList && unmergeList.size) || 0;

    return (
      <PanelHeader hasButtons>
        <div>
          <Confirm
            disabled={unmergeDisabled}
            onConfirm={onUnmerge}
            message={t(
              'These events will be unmerged and grouped into a new issue. Are you sure you want to unmerge these events?'
            )}
          >
            <Button
              size="small"
              title={tct('Unmerging [unmergeCount] events', {unmergeCount})}
            >
              {t('Unmerge')} ({unmergeCount || 0})
            </Button>
          </Confirm>

          <CompareButton
            size="small"
            disabled={!enableFingerprintCompare}
            onClick={this.handleShowDiff}
          >
            {t('Compare')}
          </CompareButton>
        </div>
        <Button size="small" onClick={onToggleCollapse}>
          {unmergeLastCollapsed ? t('Expand All') : t('Collapse All')}
        </Button>
      </PanelHeader>
    );
  }
}

export default MergedToolbar;

const CompareButton = styled(Button)`
  margin-left: ${space(1)};
`;
