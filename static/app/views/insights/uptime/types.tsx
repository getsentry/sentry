export enum CheckStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  MISSED_WINDOW = 'missed_window',
}

type StatsBucket = {
  [CheckStatus.SUCCESS]: number;
  [CheckStatus.FAILURE]: number;
  [CheckStatus.MISSED_WINDOW]: number;
};

export type CheckStatusBucket = [timestamp: number, stats: StatsBucket];
