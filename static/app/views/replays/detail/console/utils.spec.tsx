import {BreadcrumbLevelType, Crumb} from 'sentry/types/breadcrumbs';

import {getLogLevels} from './utils';

describe('getLogLevels', () => {
  const CRUMB_LOG_1 = {level: BreadcrumbLevelType.LOG} as Crumb;
  const CRUMB_LOG_2 = {level: BreadcrumbLevelType.LOG} as Crumb;
  const CRUMB_WARN = {level: BreadcrumbLevelType.WARNING} as Crumb;
  const CRUMB_ERROR = {level: BreadcrumbLevelType.ERROR} as Crumb;

  it('should return a sorted list of BreadcrumbLevelType', () => {
    const crumbs = [CRUMB_LOG_1, CRUMB_WARN, CRUMB_ERROR];
    const extra = [];
    expect(getLogLevels(crumbs, extra)).toStrictEqual([
      BreadcrumbLevelType.ERROR,
      BreadcrumbLevelType.LOG,
      BreadcrumbLevelType.WARNING,
    ]);
  });

  it('should deduplicate BreadcrumbLevelType', () => {
    const crumbs = [CRUMB_LOG_1, CRUMB_LOG_2];
    const extra = [];
    expect(getLogLevels(crumbs, extra)).toStrictEqual([BreadcrumbLevelType.LOG]);
  });

  it('should inject extra BreadcrumbLevelType values', () => {
    const crumbs = [CRUMB_WARN, CRUMB_ERROR];
    const extra = [BreadcrumbLevelType.LOG];
    expect(getLogLevels(crumbs, extra)).toStrictEqual([
      BreadcrumbLevelType.ERROR,
      BreadcrumbLevelType.LOG,
      BreadcrumbLevelType.WARNING,
    ]);
  });
});
