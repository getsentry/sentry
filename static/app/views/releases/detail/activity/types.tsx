import type {Group} from 'sentry/types';

export enum ReleaseActivityType {
  CREATED = 'created',
  DEPLOYED = 'deployed',
  FINISHED = 'finished',
  ISSUE = 'issue',
}

interface ReleaseActivityBase {
  data: {};
  dateAdded: string;
  type: ReleaseActivityType;
}

export interface ReleaseActivityCreated extends ReleaseActivityBase {
  type: ReleaseActivityType.CREATED;
}
export interface ReleaseActivityFinished extends ReleaseActivityBase {
  type: ReleaseActivityType.FINISHED;
}
export interface ReleaseActivityIssue extends ReleaseActivityBase {
  data: {
    group: Group;
  };
  type: ReleaseActivityType.ISSUE;
}
export interface ReleaseActivityDeployed extends ReleaseActivityBase {
  data: {
    environment: string;
  };
  type: ReleaseActivityType.DEPLOYED;
}

export type ReleaseActivity =
  | ReleaseActivityCreated
  | ReleaseActivityFinished
  | ReleaseActivityIssue
  | ReleaseActivityDeployed;
