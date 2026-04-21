import type {Group} from 'sentry/types/group';

export type ScoreMap = Record<string, number | null | string>;

type ScoresByInterface = NonNullable<SimilarItem['scoresByInterface']>;
type Aggregate = NonNullable<SimilarItem['aggregate']>;

export type SimilarItem = {
  isBelowThreshold: boolean;
  issue: Group;
  aggregate?: {
    exception: number;
    message: number;
    shouldBeGrouped?: string;
  };
  score?: ScoreMap;
  scoresByInterface?: {
    exception: Array<[string, number | null]>;
    message: Array<[string, any | null]>;
    shouldBeGrouped?: Array<[string, string | null]>;
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

  const scoresByInterface: Record<string, Array<[string, number | null | string]>> = {};
  for (const [scoreKey, score] of Object.entries(scoreMap)) {
    const [interfaceName = scoreKey] = scoreKey.split(':');
    (scoresByInterface[interfaceName] ??= []).push([scoreKey, score]);
  }

  const aggregate: Record<string, number | string> = {};
  for (const [interfaceName, allScores] of Object.entries(scoresByInterface)) {
    const scores = allScores.filter(
      (entry): entry is [string, number | string] => entry[1] !== null
    );

    if (hasSimilarityEmbeddingsFeature) {
      const firstScore = scores[0]?.[1];
      if (firstScore !== undefined) {
        aggregate[interfaceName] = firstScore;
      }
    } else {
      aggregate[interfaceName] =
        scores.reduce((sum, [, score]) => sum + Number(score), 0) / scores.length;
    }
  }

  return {
    issue,
    score: scoreMap,
    scoresByInterface: scoresByInterface as ScoresByInterface,
    aggregate: aggregate as Aggregate,
    isBelowThreshold,
  };
}
