export type Avatar = {
  avatarType: 'letter_avatar' | 'upload' | 'gravatar' | 'default';
  avatarUuid: string | null;
  avatarUrl?: string | null;
  color?: boolean;
};
export type ObjectStatus =
  | 'active'
  | 'disabled'
  | 'pending_deletion'
  | 'deletion_in_progress';
export type Actor = {
  id: string;
  name: string;
  type: 'user' | 'team';
  email?: string;
};
export type DateString = Date | string | null;
export type TimeseriesValue = [timestamp: number, value: number];
export type Writable<T> = {-readonly [K in keyof T]: T[K]};
export type Choice = readonly [
  value: string | number,
  label: string | number | React.ReactElement,
];
export type Choices = readonly Choice[];
export enum Outcome {
  ACCEPTED = 'accepted',
  FILTERED = 'filtered',
  INVALID = 'invalid',
  ABUSE = 'abuse',
  RATE_LIMITED = 'rate_limited',
  CLIENT_DISCARD = 'client_discard',
  CARDINALITY_LIMITED = 'cardinality_limited',
  DROPPED = 'dropped', // this is not a real outcome coming from the server
}
export type PinnedPageFilter = 'projects' | 'environments' | 'datetime';
type EmptyState = {type: 'empty'};
type InitialState = {type: 'initial'};
type LoadingState = {type: 'loading'};
type ResolvedState<T> = {
  data: T;
  type: 'resolved';
};
type ErroredState = {
  error: string;
  type: 'errored';
};
export type RequestState<T> =
  | EmptyState
  | InitialState
  | LoadingState
  | ResolvedState<T>
  | ErroredState;
