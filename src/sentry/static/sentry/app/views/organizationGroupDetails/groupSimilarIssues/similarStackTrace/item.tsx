import React from 'react';
import classNames from 'classnames';
import {css} from '@emotion/core';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {openDiffModal} from 'app/actionCreators/modal';
import Checkbox from 'app/components/checkbox';
import Count from 'app/components/count';
import EventOrGroupExtraDetails from 'app/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import FlowLayout from 'app/components/flowLayout';
import GroupingActions from 'app/actions/groupingActions';
import GroupingStore from 'app/stores/groupingStore';
import Hovercard from 'app/components/hovercard';
import ScoreBar from 'app/components/scoreBar';
import SimilarScoreCard from 'app/components/similarScoreCard';
import Button from 'app/components/button';
import SpreadLayout from 'app/components/spreadLayout';
import {Organization, Group, Project} from 'app/types';
import space from 'app/styles/space';
import {callIfFunction} from 'app/utils/callIfFunction';

const similarInterfaces = ['exception', 'message'];

type Props = {
  issue: Group;
  project: Project;
  orgId: Organization['id'];
  groupId: Group['id'];
  score?: Record<string, any>;
  scoresByInterface?: {
    exception: Array<[string, number | null]>;
    message: Array<[string, any | null]>;
  };
  aggregate?: {
    exception: number;
    message: number;
  };
};

const initialState = {visible: true, checked: false, busy: false};

type State = typeof initialState;

class Item extends React.Component<Props, State> {
  state: State = initialState;

  componentWillUnmount() {
    callIfFunction(this.listener);
  }

  listener = GroupingStore.listen(data => this.onGroupChange(data), undefined);

  handleToggle = () => {
    const {issue} = this.props;

    // clicking anywhere in the row will toggle the checkbox
    if (!this.state.busy) {
      GroupingActions.toggleMerge(issue.id);
    }
  };

  handleShowDiff = (event: React.MouseEvent) => {
    const {orgId, groupId: baseIssueId, issue, project} = this.props;
    const {id: targetIssueId} = issue;

    openDiffModal({baseIssueId, targetIssueId, project, orgId});
    event.stopPropagation();
  };

  handleCheckClick = () => {
    // noop to appease React warnings
    // This is controlled via row click instead of only Checkbox
  };

  onGroupChange = ({mergeState}) => {
    if (!mergeState) {
      return;
    }

    const {issue} = this.props;

    const stateForId = mergeState.has(issue.id) && mergeState.get(issue.id);

    if (!stateForId) {
      return;
    }

    Object.keys(stateForId).forEach(key => {
      if (stateForId[key] === this.state[key]) {
        return;
      }
      this.setState(prevState => ({
        ...prevState,
        [key]: stateForId[key],
      }));
    });
  };

  render() {
    const {aggregate, scoresByInterface, issue} = this.props;
    const {visible, busy} = this.state;

    if (!visible) {
      return null;
    }

    const cx = classNames('group', 'similar-issue', {
      isResolved: issue.status === 'resolved',
      busy,
    });

    return (
      <SpreadLayout
        data-test-id="similar-item-row"
        className={cx}
        onClick={this.handleToggle}
        responsive
      >
        <FlowLayout truncate>
          <FlowLayout truncate>
            <ActionColumn>
              <Checkbox
                id={issue.id}
                value={issue.id}
                checked={this.state.checked}
                onChange={this.handleCheckClick}
              />
            </ActionColumn>
            <EventDetails className="event-details">
              <EventOrGroupHeader data={issue} />
              <EventOrGroupExtraDetails data={{...issue, lastSeen: ''}} showAssignee />
            </EventDetails>
          </FlowLayout>
          <StyledButton onClick={this.handleShowDiff} size="small">
            {t('Diff')}
          </StyledButton>
        </FlowLayout>

        <Columns>
          <StyledCount value={issue.count} />

          {similarInterfaces.map(interfaceName => {
            const avgScore = aggregate?.[interfaceName];
            const scoreList = scoresByInterface?.[interfaceName] || [];
            // Check for valid number (and not NaN)
            const scoreValue =
              typeof avgScore === 'number' && !Number.isNaN(avgScore) ? avgScore : 0;

            return (
              <Column key={interfaceName}>
                <Hovercard
                  body={scoreList.length && <SimilarScoreCard scoreList={scoreList} />}
                >
                  <ScoreBar vertical score={Math.round(scoreValue * 5)} />
                </Hovercard>
              </Column>
            );
          })}
        </Columns>
      </SpreadLayout>
    );
  }
}

export default Item;

const Columns = styled('div')`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  min-width: 300px;
  width: 300px;
`;

const columnStyle = css`
  flex: 1;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding: ${space(0.5)} 0;
`;

const Column = styled('div')`
  ${columnStyle}
`;

const StyledCount = styled(Count)`
  ${columnStyle}
`;

const StyledButton = styled(Button)`
  margin-right: ${space(0.25)};
`;

const ActionColumn = styled('div')`
  text-align: center;
  width: 54px;
`;

const EventDetails = styled('div')`
  flex: 1;
`;
