import {Component} from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {openDiffModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import {PanelHeader} from 'sentry/components/panels';
import {t, tct} from 'sentry/locale';
import GroupingStore from 'sentry/stores/groupingStore';
import space from 'sentry/styles/space';
import {Group, Organization, Project} from 'sentry/types';

type Props = {
  groupId: Group['id'];
  onToggleCollapse: () => void;
  onUnmerge: () => void;
  orgId: Organization['slug'];
  project: Project;
};

type State = {
  enableFingerprintCompare: boolean;
  unmergeDisabled: boolean;
  unmergeLastCollapsed: boolean;
  unmergeList: Map<any, any>;
};

class MergedToolbar extends Component<Props, State> {
  state: State = this.getInitialState();

  getInitialState() {
    // @ts-ignore GroupingStore types are not correct, store.init dynamically sets these
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
