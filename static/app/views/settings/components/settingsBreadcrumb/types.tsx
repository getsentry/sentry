import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';

// TODO(ts): The `name` attribute doesn't appear on any of the react router route types

export interface RouteWithName {
  name?: string;
  path?: string;
}

export type SettingsBreadcrumbProps = Pick<RouteComponentProps, 'route' | 'routes'> & {
  isLast: boolean;
};
