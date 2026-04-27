import type {Group} from 'sentry/types/group';

type ScoreMap = Record<string, number | null | string>;

export type SimilarItem = {
  isBelowThreshold: boolean;
  issue: Group;
  aggregate?: {
    exception: number;
    message: number;
  };
  scoresByInterface?: {
    exception: Array<[string, number | null]>;
    message: Array<[string, number | null]>;
  };
};

export type SimilarApiResponse = Array<[Group, ScoreMap]>;

const MIN_SCORE = 0.6;

function checkBelowThreshold(scores: ScoreMap) {
  return !Object.values(scores).some(score => Number(score) >= MIN_SCORE);
}

export function processSimilarItem(
  [issue, scoreMap]: [Group, ScoreMap],
  hasSimilarityEmbeddingsFeature: boolean
): SimilarItem {
  const isBelowThreshold = hasSimilarityEmbeddingsFeature
    ? false
    : checkBelowThreshold(scoreMap);

  const scoresByInterface = Object.entries(scoreMap).reduce<
    Record<string, Array<[string, number | null | string]>>
  >((acc, [scoreKey, score]) => {
    const [interfaceName] = String(scoreKey).split(':') as [string];

    if (!acc[interfaceName]) {
      acc[interfaceName] = [];
    }
    acc[interfaceName].push([scoreKey, score]);

    return acc;
  }, {});

  const aggregate = Object.entries(scoresByInterface).reduce<
    Record<string, number | string>
  >((acc, [interfaceName, allScores]) => {
    const scores = allScores.filter(([, score]) => score !== null);

    const avg = scores.reduce((sum, [, score]) => sum + Number(score), 0) / scores.length;
    acc[interfaceName] = hasSimilarityEmbeddingsFeature
      ? (scores[0]![1] as number | string)
      : avg;
    return acc;
  }, {});

  return {
    issue,
    scoresByInterface: scoresByInterface as SimilarItem['scoresByInterface'],
    aggregate: aggregate as SimilarItem['aggregate'],
    isBelowThreshold,
  };
}
