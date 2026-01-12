import {useCallback, useEffect, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {Flex} from '@sentry/scraps/layout';

import {openDiffModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {Checkbox} from 'sentry/components/core/checkbox';
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
import type {Project} from 'sentry/types/project';

type Props = {
  groupId: Group['id'];
  hasSimilarityEmbeddingsFeature: boolean;
  issue: Group;
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

const similarityEmbeddingScoreValues = [0.9, 0.925, 0.95, 0.975, 0.99, 1];

export function SimilarStackTraceItem(props: Props) {
  const {aggregate, scoresByInterface, issue, hasSimilarityEmbeddingsFeature} = props;
  const [checked, setChecked] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  const onGroupChange = useCallback(
    ({mergeState}: ReturnType<typeof GroupingStore.getState>) => {
      if (!mergeState) {
        return;
      }

      const stateForId = mergeState.has(issue.id) && mergeState.get(issue.id);

      if (!stateForId) {
        return;
      }

      setChecked(prev =>
        typeof stateForId.checked === 'undefined' ? prev : stateForId.checked
      );
      setBusy(prev => (typeof stateForId.busy === 'undefined' ? prev : stateForId.busy));
    },
    [issue.id]
  );

  useEffect(() => {
    const unsubscribe = GroupingStore.listen(
      (data: ReturnType<typeof GroupingStore.getState>) => onGroupChange(data),
      undefined
    );
    return () => {
      unsubscribe?.();
    };
  }, [onGroupChange]);

  const handleToggle = useCallback(() => {
    // clicking anywhere in the row will toggle the checkbox
    if (!busy) {
      GroupingStore.onToggleMerge(issue.id);
    }
  }, [busy, issue.id]);

  const handleShowDiff = useCallback(
    (event: React.MouseEvent) => {
      const {groupId: baseIssueId, project} = props;
      const {id: targetIssueId} = issue;

      openDiffModal({
        baseIssueId,
        targetIssueId,
        project,
      });
      event.stopPropagation();
    },
    [issue, props]
  );

  const similarInterfaces: Array<'exception' | 'message'> = hasSimilarityEmbeddingsFeature
    ? ['exception']
    : ['exception', 'message'];

  const cx = classNames('group', {
    isResolved: issue.status === 'resolved',
    busy,
  });

  return (
    <StyledPanelItem
      data-test-id="similar-item-row"
      className={cx}
      onClick={handleToggle}
    >
      <Details>
        <Checkbox id={issue.id} value={issue.id} checked={checked} onChange={() => {}} />
        <EventDetails>
          <EventOrGroupHeader data={issue} source="similar-issues" />
          <EventOrGroupExtraDetails data={{...issue, lastSeen: ''}} showAssignee />
        </EventDetails>

        <Flex align="center" marginRight="2xs" height="100%">
          <Button onClick={handleShowDiff} size="sm">
            {t('Diff')}
          </Button>
        </Flex>
      </Details>

      <Flex align="center" flexShrink={0} width="350px" minWidth="350px">
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
              if (scoreValue <= similarityEmbeddingScoreValues[i]!) {
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
              {hasSimilarityEmbeddingsFeature && <ScoreBar vertical score={scoreValue} />}
            </Column>
          );
        })}
      </Flex>
    </StyledPanelItem>
  );
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

const EventDetails = styled('div')`
  flex: 1;
  ${p => p.theme.overflowEllipsis};
`;
