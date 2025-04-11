import type {RouteComponentProps, RouteProps} from 'sentry/types/legacyReactRouter';

// TODO(ts): The `name` attribute doesn't appear on any of the react router route types

export type RouteWithName = RouteProps & {
  name?: string;
};

export type SettingsBreadcrumbProps = Pick<RouteComponentProps, 'route' | 'routes'> & {
  isLast: boolean;
};
