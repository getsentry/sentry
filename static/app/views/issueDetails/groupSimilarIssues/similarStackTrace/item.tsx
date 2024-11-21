import {Component} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import classNames from 'classnames';
import type {Location} from 'history';

import {openDiffModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import Checkbox from 'sentry/components/checkbox';
import Count from 'sentry/components/count';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import {Hovercard} from 'sentry/components/hovercard';
import PanelItem from 'sentry/components/panels/panelItem';
import ScoreBar from 'sentry/components/scoreBar';
import SimilarScoreCard from 'sentry/components/similarScoreCard';
import {t} from 'sentry/locale';
import GroupingStore from 'sentry/stores/groupingStore';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

type Props = {
  groupId: Group['id'];
  hasSimilarityEmbeddingsFeature: boolean;
  issue: Group;
  location: Location;
  orgId: Organization['id'];
  project: Project;
  aggregate?: {
    exception: number;
    message?: number;
  };
  score?: Record<string, any>;
  scoresByInterface?: {
    exception: Array<[string, number | null]>;
    message: Array<[string, any | null]>;
  };
};

const initialState = {visible: true, checked: false, busy: false};

const similarityEmbeddingScoreValues = [0.9, 0.925, 0.95, 0.975, 0.99, 1];

type State = typeof initialState;

class Item extends Component<Props, State> {
  state: State = initialState;

  componentWillUnmount() {
    this.listener?.();
  }

  listener = GroupingStore.listen(data => this.onGroupChange(data), undefined);

  handleToggle = () => {
    const {issue} = this.props;

    // clicking anywhere in the row will toggle the checkbox
    if (!this.state.busy) {
      GroupingStore.onToggleMerge(issue.id);
    }
  };

  handleShowDiff = (event: React.MouseEvent) => {
    const {orgId, groupId: baseIssueId, issue, project, location} = this.props;
    const {id: targetIssueId} = issue;

    openDiffModal({
      baseIssueId,
      targetIssueId,
      project,
      orgId,
      location,
    });
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
    const {aggregate, scoresByInterface, issue, hasSimilarityEmbeddingsFeature} =
      this.props;
    const {visible, busy} = this.state;
    const similarInterfaces = hasSimilarityEmbeddingsFeature
      ? ['exception']
      : ['exception', 'message'];

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
            <EventOrGroupHeader data={issue} source="similar-issues" />
            <EventOrGroupExtraDetails data={{...issue, lastSeen: ''}} showAssignee />
          </EventDetails>

          <Diff>
            <Button onClick={this.handleShowDiff} size="sm">
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
            let scoreValue =
              typeof avgScore === 'number' && !Number.isNaN(avgScore) ? avgScore : 0;
            // If hasSimilarityEmbeddingsFeature is on, translate similarity score in range 0.9-1 to score between 1-5
            if (hasSimilarityEmbeddingsFeature) {
              for (let i = 0; i <= similarityEmbeddingScoreValues.length; i++) {
                if (scoreValue <= similarityEmbeddingScoreValues[i]) {
                  scoreValue = i;
                  break;
                }
              }
            }

            return (
              <Column key={interfaceName}>
                {!hasSimilarityEmbeddingsFeature && (
                  <Hovercard
                    body={scoreList.length && <SimilarScoreCard scoreList={scoreList} />}
                  >
                    <ScoreBar vertical score={Math.round(scoreValue * 5)} />
                  </Hovercard>
                )}
                {hasSimilarityEmbeddingsFeature && (
                  <ScoreBar vertical score={scoreValue} />
                )}
              </Column>
            );
          })}
        </Columns>
      </StyledPanelItem>
    );
  }
}

const Details = styled('div')`
  ${p => p.theme.overflowEllipsis};

  display: grid;
  align-items: start;
  gap: ${space(1)};
  grid-template-columns: max-content auto max-content;
  margin-left: ${space(2)};
`;

const StyledPanelItem = styled(PanelItem)`
  padding: ${space(1)} 0;
`;

const Columns = styled('div')`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  min-width: 350px;
  width: 350px;
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
  height: 100%;
  display: flex;
  align-items: center;
  margin-right: ${space(0.25)};
`;

const EventDetails = styled('div')`
  flex: 1;
  ${p => p.theme.overflowEllipsis};
`;

export default Item;
