import type {
  BreadcrumbListProps,
  BreadcrumbTitleItem,
} from '@sentry/scraps/breadcrumbList';

import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';

// TODO(ts): The `name` attribute doesn't appear on any of the react router route types

export interface RouteWithName {
  name?: string;
  path?: string;
}

export type SettingsBreadcrumbProps = Pick<RouteComponentProps, 'route' | 'routes'> & {
  isLast: boolean;
  itemIndex: number;
  items: BreadcrumbListProps['items'];
  title: BreadcrumbTitleItem;
  fallback?: boolean;
};
