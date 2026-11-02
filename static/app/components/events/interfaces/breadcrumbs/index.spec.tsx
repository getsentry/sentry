import {applyBreadcrumbSearch} from 'sentry/components/events/interfaces/breadcrumbs';
import type {BreadcrumbWithMeta} from 'sentry/components/events/interfaces/breadcrumbs/types';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';

function createCrumb(id: number, message: string): BreadcrumbWithMeta {
  return {
    breadcrumb: {
      id,
      description: 'Debug',
      variant: 'muted',
      type: BreadcrumbType.DEBUG,
      level: BreadcrumbLevelType.INFO,
      message,
    },
    meta: {},
  };
}

describe('applyBreadcrumbSearch', () => {
  it('matches across escape codes when a message contains ANSI', () => {
    const ansiCrumb = createCrumb(0, '\x1B[31mfailed\x1B[0m to connect');
    const otherCrumb = createCrumb(1, 'connected');

    const result = applyBreadcrumbSearch([ansiCrumb, otherCrumb], 'failed to');

    expect(result).toEqual([ansiCrumb]);
  });
});
