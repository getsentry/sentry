import * as Sentry from '@sentry/react';

import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';

export function Breadcrumb(params: Partial<Sentry.Breadcrumb> = {}): Sentry.Breadcrumb {
  return {
    type: BreadcrumbType.NAVIGATION,
    category: 'default',
    timestamp: new Date().getTime(),
    level: BreadcrumbLevelType.INFO,
    message: 'https://sourcemaps.io/',
    data: {
      to: 'https://sourcemaps.io/',
    },
    ...params,
  };
}
