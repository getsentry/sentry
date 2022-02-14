import * as React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {openDiffModal} from 'sentry/actionCreators/modal';
import GroupingActions from 'sentry/actions/groupingActions';
import Button from 'sentry/components/button';
import Checkbox from 'sentry/components/checkbox';
import Count from 'sentry/components/count';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import {Hovercard} from 'sentry/components/hovercard';
import {PanelItem} from 'sentry/components/panels';
import ScoreBar from 'sentry/components/scoreBar';
import SimilarScoreCard from 'sentry/components/similarScoreCard';
import {t} from 'sentry/locale';
import GroupingStore from 'sentry/stores/groupingStore';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Group, Organization, Project} from 'sentry/types';
import {callIfFunction} from 'sentry/utils/callIfFunction';

type Props = {
  groupId: Group['id'];
  issue: Group;
  orgId: Organization['id'];
  project: Project;
  v2: boolean;
  aggregate?: {
    exception: number;
    message: number;
  };
  score?: Record<string, any>;
  scoresByInterface?: {
    exception: Array<[string, number | null]>;
    message: Array<[string, any | null]>;
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
  font-variant-numeric: tabular-nums;
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
