import type {Group} from 'sentry/types/group';

export type ScoreMap = Record<string, number | null | string>;

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
