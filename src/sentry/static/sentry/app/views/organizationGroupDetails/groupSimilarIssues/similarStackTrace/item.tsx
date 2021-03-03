import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {openDiffModal} from 'app/actionCreators/modal';
import GroupingActions from 'app/actions/groupingActions';
import Button from 'app/components/button';
import Checkbox from 'app/components/checkbox';
import Count from 'app/components/count';
import EventOrGroupExtraDetails from 'app/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import Hovercard from 'app/components/hovercard';
import {PanelItem} from 'app/components/panels';
import ScoreBar from 'app/components/scoreBar';
import SimilarScoreCard from 'app/components/similarScoreCard';
import {t} from 'app/locale';
import GroupingStore from 'app/stores/groupingStore';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Group, Organization, Project} from 'app/types';
import {callIfFunction} from 'app/utils/callIfFunction';

type Props = {
  issue: Group;
  project: Project;
  orgId: Organization['id'];
  groupId: Group['id'];
  v2: boolean;
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
    const {aggregate, scoresByInterface, issue, v2} = this.props;
    const {visible, busy} = this.state;
    const similarInterfaces = v2 ? ['similarity'] : ['exception', 'message'];

    if (!visible) {
      return null;
    }

    const cx = classNames('group', {
      isResolved: issue.status === 'resolved',
      busy,
    });

    return (
      <StyledPanelItem
        data-test-id="similar-item-row"
        className={cx}
        onClick={this.handleToggle}
      >
        <Details>
          <Checkbox
            id={issue.id}
            value={issue.id}
            checked={this.state.checked}
            onChange={this.handleCheckClick}
          />
          <EventDetails>
            <EventOrGroupHeader data={issue} includeLink size="normal" />
            <EventOrGroupExtraDetails data={{...issue, lastSeen: ''}} showAssignee />
          </EventDetails>

          <Diff>
            <Button onClick={this.handleShowDiff} size="small">
              {t('Diff')}
            </Button>
          </Diff>
        </Details>

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
      </StyledPanelItem>
    );
  }
}

const Details = styled('div')`
  ${overflowEllipsis};

  display: grid;
  gap: ${space(1)};
  grid-template-columns: max-content auto max-content;
  margin-left: ${space(2)};

  input[type='checkbox'] {
    margin: 0;
  }
`;

const StyledPanelItem = styled(PanelItem)`
  padding: ${space(1)} 0;
`;

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

const Diff = styled('div')`
  display: flex;
  align-items: center;
  margin-right: ${space(0.25)};
`;

const EventDetails = styled('div')`
  flex: 1;
  ${overflowEllipsis};
`;

export default Item;
