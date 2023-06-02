import {BreadcrumbFrame as TBreadcrumbFrame} from 'sentry/utils/replays/types';

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

type TestableFrame<Cat extends TBreadcrumbFrame['category']> = Overwrite<
  Partial<Extract<TBreadcrumbFrame, {category: Cat}>>,
  {timestamp: Date}
>;

type MockFrame<Cat extends TBreadcrumbFrame['category']> = Extract<
  TBreadcrumbFrame,
  {category: Cat}
>;

export function ConsoleFrame(fields: TestableFrame<'console'>): MockFrame<'console'> {
  return {
    category: 'console',
    data: fields.data ?? {
      logger: 'unknown',
    },
    level: fields.level ?? 'fatal',
    message: fields.message ?? '',
    timestamp: fields.timestamp.getTime(),
    type: '',
  };
}

export function ClickFrame(fields: TestableFrame<'ui.click'>): MockFrame<'ui.click'> {
  return {
    category: 'ui.click',
    data: fields.data ?? {},
    message: fields.message ?? '',
    timestamp: fields.timestamp.getTime(),
    type: '',
  };
}

export function FetchFrame(fields: TestableFrame<'fetch'>): MockFrame<'fetch'> {
  return {
    category: 'fetch',
    data: fields.data ?? {
      method: 'get',
      url: '/',
    },
    message: fields.message,
    timestamp: fields.timestamp.getTime(),
    type: 'http',
  };
}

export function InputFrame(fields: TestableFrame<'ui.input'>): MockFrame<'ui.input'> {
  return {
    category: 'ui.input',
    message: fields.message ?? '',
    timestamp: fields.timestamp.getTime(),
    type: '',
  };
}

export function XhrFrame(fields: TestableFrame<'xhr'>): MockFrame<'xhr'> {
  return {
    category: 'xhr',
    data: fields.data ?? {},
    message: fields.message,
    timestamp: fields.timestamp.getTime(),
    type: 'http',
  };
}

export function KeyboardEventFrame(
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
    timestamp: fields.timestamp.getTime(),
    type: '',
  };
}

export function BlurFrame(fields: TestableFrame<'ui.blur'>): MockFrame<'ui.blur'> {
  return {
    category: 'ui.blur',
    message: fields.message,
    timestamp: fields.timestamp.getTime(),
    type: '',
  };
}

export function FocusFrame(fields: TestableFrame<'ui.focus'>): MockFrame<'ui.focus'> {
  return {
    category: 'ui.focus',
    message: fields.message,
    timestamp: fields.timestamp.getTime(),
    type: '',
  };
}

export function SlowClickFrame(
  fields: TestableFrame<'ui.slowClickDetected'>
): MockFrame<'ui.slowClickDetected'> {
  return {
    category: 'ui.slowClickDetected',
    data: fields.data ?? {
      endReason: '',
      timeAfterClickFs: 5,
      url: '/',
    },
    message: fields.message,
    timestamp: fields.timestamp.getTime(),
    type: '',
  };
}

export function MutationFrame(
  fields: TestableFrame<'replay.mutations'>
): MockFrame<'replay.mutations'> {
  return {
    category: 'replay.mutations',
    data: fields.data ?? {
      count: 1100,
      limit: true,
    },
    message: fields.message,
    timestamp: fields.timestamp.getTime(),
    type: '',
  };
}
