import {ThemeFixture} from 'sentry-fixture/theme';

import {getEnhancedBreadcrumbsFromValues} from 'sentry/components/events/breadcrumbs/utils';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import type {RawCrumb} from 'sentry/types/breadcrumbs';

describe('getEnhancedBreadcrumbsFromValues', () => {
  const theme = ThemeFixture();

  it('skips null breadcrumbs while keeping meta aligned', () => {
    const first: RawCrumb = {
      type: BreadcrumbType.DEFAULT,
      level: BreadcrumbLevelType.INFO,
      category: 'first',
      message: 'first',
      timestamp: '2026-11-03T19:47:00Z',
    };
    const second: RawCrumb = {
      type: BreadcrumbType.DEFAULT,
      level: BreadcrumbLevelType.INFO,
      category: 'second',
      message: 'second',
      timestamp: '2026-11-03T19:47:01Z',
    };
    const meta = {0: {message: {'': {len: 1}}}, 2: {message: {'': {len: 2}}}};

    const result = getEnhancedBreadcrumbsFromValues({
      breadcrumbs: [first, null, second],
      theme,
      meta,
    });

    expect(result).toHaveLength(2);
    expect(result[0]!.raw).toBe(first);
    expect(result[0]!.meta).toBe(meta[0]);
    expect(result[1]!.raw).toBe(second);
    expect(result[1]!.meta).toBe(meta[2]);
  });
});
