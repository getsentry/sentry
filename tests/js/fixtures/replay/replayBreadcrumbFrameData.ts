import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import {RawBreadcrumbFrame} from 'sentry/utils/replays/types';

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

export function ReplayInputFrameFixture(
  fields: TestableFrame<'ui.input'>
): MockFrame<'ui.input'> {
  return {
    category: 'ui.input',
    message: fields.message ?? '',
    timestamp: fields.timestamp.getTime() / 1000,
    type: BreadcrumbType.DEFAULT,
  };
}

export function ReplayKeyboardEventFrameFixture(
  fields: TestableFrame<'ui.keyDown'>
): MockFrame<'ui.keyDown'> {
  return {
    category: 'ui.keyDown',
    data: fields.data ?? {
      altKey: false,
      ctrlKey: false,
      key: 'A',
      metaKey: false,
      shiftKey: false,
    },
    message: fields.message,
    timestamp: fields.timestamp.getTime() / 1000,
    type: BreadcrumbType.DEFAULT,
  };
}

export function ReplayBlurFrameFixture(
  fields: TestableFrame<'ui.blur'>
): MockFrame<'ui.blur'> {
  return {
    category: 'ui.blur',
    message: fields.message,
    timestamp: fields.timestamp.getTime() / 1000,
    type: BreadcrumbType.DEFAULT,
  };
}

export function ReplayFocusFrameFixture(
  fields: TestableFrame<'ui.focus'>
): MockFrame<'ui.focus'> {
  return {
    category: 'ui.focus',
    message: fields.message,
    timestamp: fields.timestamp.getTime() / 1000,
    type: BreadcrumbType.DEFAULT,
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

export function ReplayMutationFrameFixture(
  fields: TestableFrame<'replay.mutations'>
): MockFrame<'replay.mutations'> {
  return {
    category: 'replay.mutations',
    data: fields.data ?? {
      count: 1100,
      limit: true,
    },
    message: fields.message,
    timestamp: fields.timestamp.getTime() / 1000,
    type: '',
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
