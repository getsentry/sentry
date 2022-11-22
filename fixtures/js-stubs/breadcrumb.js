import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';

export function Breadcrumb(params = []) {
  return {
    type: BreadcrumbType.NAVIGATION,
    category: 'default',
    timestamp: new Date().toISOString(),
    level: BreadcrumbLevelType.INFO,
    message: 'https://sourcemaps.io/',
    data: {
      to: 'https://sourcemaps.io/',
    },
    id: 6,
    color: 'green300',
    description: 'Navigation',
    ...params,
  };
}
