import {useCallback} from 'react';

import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {Stack} from '@sentry/scraps/layout';

import {openDiffModal} from 'sentry/actionCreators/modal';
import {Count} from 'sentry/components/count';
import {GroupHeaderRow} from 'sentry/components/groupHeaderRow';
import {GroupMetaRow} from 'sentry/components/groupMetaRow';
import {Hovercard} from 'sentry/components/hovercard';
import {Placeholder} from 'sentry/components/placeholder';
import {ScoreBar} from 'sentry/components/scoreBar';
import {SimilarScoreCard} from 'sentry/components/similarScoreCard';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';

import type {SimilarItem} from './types';

type Props = SimilarItem & {
  busy: boolean;
  checked: boolean;
  groupId: Group['id'];
  hasSimilarityEmbeddingsFeature: boolean;
  onToggle: (id: string) => void;
  project: Project;
};

const similarityEmbeddingScoreValues = [0.9, 0.925, 0.95, 0.975, 0.99, 1];

export function SimilarStackTraceItem({
  aggregate,
  scoresByInterface,
  issue,
  groupId,
  project,
  hasSimilarityEmbeddingsFeature,
  checked,
  busy,
  onToggle,
}: Props) {
  const handleToggle = useCallback(() => {
    if (!busy) {
      onToggle(issue.id);
    }
  }, [busy, issue.id, onToggle]);

  const handleShowDiff = (event: React.MouseEvent) => {
    openDiffModal({baseIssueId: groupId, targetIssueId: issue.id, project});
    event.stopPropagation();
  };

  const similarInterfaces = hasSimilarityEmbeddingsFeature
    ? (['exception'] as const)
    : (['exception', 'message'] as const);

  return (
    <SimpleTable.Row
      data-test-id="similar-item-row"
      variant={busy ? 'faded' : 'default'}
      onClick={handleToggle}
    >
      <SimpleTable.RowCell gap="md" cursor="pointer">
        <Checkbox id={issue.id} value={issue.id} checked={checked} onChange={() => {}} />
        <Stack minWidth="0" flex="1">
          <GroupHeaderRow data={issue} source="similar-issues" />
          <GroupMetaRow data={{...issue, lastSeen: ''}} />
        </Stack>
      </SimpleTable.RowCell>

      <SimpleTable.RowCell justify="center">
        <Count value={issue.count} />
      </SimpleTable.RowCell>

      {similarInterfaces.map(interfaceName => {
        const avgScore = aggregate?.[interfaceName];
        const scoreList = scoresByInterface?.[interfaceName] || [];

        let scoreValue =
          typeof avgScore === 'number' && !Number.isNaN(avgScore) ? avgScore : 0;
        if (hasSimilarityEmbeddingsFeature) {
          for (let i = 0; i <= similarityEmbeddingScoreValues.length; i++) {
            if (scoreValue <= similarityEmbeddingScoreValues[i]!) {
              scoreValue = i;
              break;
            }
          }
        }

        return (
          <SimpleTable.RowCell justify="center" key={interfaceName}>
            {hasSimilarityEmbeddingsFeature ? (
              <ScoreBar vertical score={scoreValue} />
            ) : (
              <Hovercard
                body={
                  scoreList.length > 0 ? <SimilarScoreCard scoreList={scoreList} /> : null
                }
              >
                <ScoreBar vertical score={Math.round(scoreValue * 5)} />
              </Hovercard>
            )}
          </SimpleTable.RowCell>
        );
      })}

      <SimpleTable.RowCell justify="center">
        <Button onClick={handleShowDiff} size="xs">
          {t('Diff')}
        </Button>
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

export function SimilarStackTraceItemSkeleton({
  hasSimilarityEmbeddingsFeature,
}: {
  hasSimilarityEmbeddingsFeature: boolean;
}) {
  const scoreColumns = hasSimilarityEmbeddingsFeature ? 1 : 2;
  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell gap="md" cursor="pointer">
        <Placeholder height="16px" width="16px" />
        <Stack gap="xs" flex="1" minWidth="0">
          <Placeholder height="16px" width="60%" />
          <Placeholder height="12px" width="40%" />
        </Stack>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="center">
        <Placeholder height="16px" width="32px" />
      </SimpleTable.RowCell>
      {Array.from({length: scoreColumns}).map((_, i) => (
        <SimpleTable.RowCell justify="center" key={i}>
          <Placeholder height="24px" width="40px" />
        </SimpleTable.RowCell>
      ))}
      <SimpleTable.RowCell justify="center">
        <Placeholder height="24px" width="44px" />
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}
