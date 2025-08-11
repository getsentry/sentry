import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import type {
  RawBreadcrumbFrame,
  RawHydrationErrorFrame,
} from 'sentry/utils/replays/types';

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

type TestableFrame<Cat extends RawBreadcrumbFrame['category']> = Overwrite<
  Partial<Extract<RawBreadcrumbFrame, {category: Cat}>>,
  {timestamp: Date}
>;

type MockFrame<Cat extends RawBreadcrumbFrame['category']> = Extract<
  RawBreadcrumbFrame,
  {category: Cat}
>;

export function ReplayConsoleFrameFixture(
  fields: TestableFrame<'console'>
): MockFrame<'console'> {
  return {
    category: 'console',
    data: fields.data ?? {
      logger: 'unknown',
    },
    level: fields.level ?? 'fatal',
    message: fields.message ?? '',
    timestamp: fields.timestamp.getTime() / 1000,
    type: BreadcrumbType.DEBUG,
  };
}

export function ReplayClickFrameFixture(
  fields: TestableFrame<'ui.click'>
): MockFrame<'ui.click'> {
  return {
    category: 'ui.click',
    data: fields.data ?? {},
    message: fields.message ?? '',
    timestamp: fields.timestamp.getTime() / 1000,
    type: BreadcrumbType.UI,
  };
}

export function ReplaySlowClickFrameFixture(
  fields: TestableFrame<'ui.slowClickDetected'>
): MockFrame<'ui.slowClickDetected'> {
  return {
    category: 'ui.slowClickDetected',
    data: fields.data ?? {
      clickCount: undefined,
      endReason: '',
      timeAfterClickMs: 5,
      url: '/',
    },
    message: fields.message,
    timestamp: fields.timestamp.getTime() / 1000,
    type: BreadcrumbType.DEFAULT,
  };
}

export function ReplayHydrationErrorFrameFixture(
  fields: TestableFrame<'replay.hydrate-error'>
): RawHydrationErrorFrame {
  return {
    category: 'replay.hydrate-error',
    message: '',
    timestamp: fields.timestamp.getTime() / 1000,
    data: fields.data ?? undefined,
    type: BreadcrumbType.DEFAULT,
  };
}

export function ReplayNavFrameFixture(
  fields: TestableFrame<'navigation'>
): MockFrame<'navigation'> {
  return {
    category: 'navigation',
    data: fields.data ?? {
      from: '',
      to: '',
    },
    message: fields.message ?? '',
    timestamp: fields.timestamp.getTime() / 1000,
    type: '',
  };
}
