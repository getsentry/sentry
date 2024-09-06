import type {RouteProps} from 'sentry/types/legacyReactRouter';

// TODO(ts): The `name` attribute doesn't appear on any of the react router route types

export type RouteWithName = RouteProps & {
  name?: string;
};
