import {RawSpanFrame} from 'sentry/utils/replays/types';

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

type TestableFrame<Op extends RawSpanFrame['op']> = Overwrite<
  Partial<Extract<RawSpanFrame, {op: Op}>>,
  {endTimestamp: Date; startTimestamp: Date}
>;

type MockFrame<Op extends RawSpanFrame['op']> = Extract<RawSpanFrame, {op: Op}>;

function BaseFrame<T extends RawSpanFrame['op']>(
  op: T,
  fields: TestableFrame<T>
): MockFrame<T> {
  return {
    op,
    description: fields.description ?? '',
    startTimestamp: fields.startTimestamp.getTime() / 1000,
    endTimestamp: fields.endTimestamp.getTime() / 1000,
    data: fields.data,
  } as MockFrame<T>;
}

export function ReplayLargestContentfulPaintFrameFixture(
  fields: TestableFrame<'largest-contentful-paint'>
): MockFrame<'largest-contentful-paint'> {
  return BaseFrame('largest-contentful-paint', {
    ...fields,
    data: {
      nodeId: fields.data?.nodeId,
      size: fields.data?.size ?? 0,
      value: fields.data?.value ?? 0,
    },
  });
}

export function ReplayMemoryFrameFixture(
  fields: TestableFrame<'memory'>
): MockFrame<'memory'> {
  return BaseFrame('memory', {
    ...fields,
    data: {
      memory: {
        jsHeapSizeLimit: fields.data?.memory?.jsHeapSizeLimit ?? 0,
        totalJSHeapSize: fields.data?.memory?.totalJSHeapSize ?? 0,
        usedJSHeapSize: fields.data?.memory?.usedJSHeapSize ?? 0,
      },
    },
  });
}

export function ReplayNavigationFrameFixture(
  fields: TestableFrame<
    'navigation.navigate' | 'navigation.reload' | 'navigation.back_forward'
  >
): MockFrame<'navigation.navigate' | 'navigation.reload' | 'navigation.back_forward'> {
  return BaseFrame(fields.op ?? 'navigation.navigate', {
    ...fields,
    data: {
      decodedBodySize: fields.data?.decodedBodySize,
      domComplete: fields.data?.domComplete,
      domContentLoadedEventEnd: fields.data?.domContentLoadedEventEnd,
      domContentLoadedEventStart: fields.data?.domContentLoadedEventStart,
      domInteractive: fields.data?.domInteractive,
      duration: fields.data?.duration,
      encodedBodySize: fields.data?.encodedBodySize,
      loadEventEnd: fields.data?.loadEventEnd,
      loadEventStart: fields.data?.loadEventStart,
      redirectCount: fields.data?.redirectCount,
      size: fields.data?.size,
    },
  });
}

export function ReplayNavigationPushFrameFixture(
  fields: TestableFrame<'navigation.push'>
): MockFrame<'navigation.push'> {
  return BaseFrame('navigation.push', {
    ...fields,
    data: {
      previous: fields.data?.previous ?? '/',
    },
  });
}

export function ReplayPaintFrameFixture(
  fields: TestableFrame<'paint'>
): MockFrame<'paint'> {
  return BaseFrame('paint', fields);
}

export function ReplayRequestFrameFixture(
  fields: TestableFrame<'resource.fetch' | 'resource.xhr'>
): MockFrame<'resource.fetch' | 'resource.xhr'> {
  return BaseFrame(fields.op ?? 'resource.xhr', {
    ...fields,
    data: {
      method: fields.data?.method,
      requestBodySize: fields.data?.requestBodySize,
      responseBodySize: fields.data?.responseBodySize,
      statusCode: fields.data?.statusCode,
      request: fields.data?.request,
      response: fields.data?.response,
    },
  });
}

export function ReplayResourceFrameFixture(
  fields: TestableFrame<
    | 'resource.css'
    | 'resource.iframe'
    | 'resource.img'
    | 'resource.link'
    | 'resource.other'
    | 'resource.script'
  >
): MockFrame<
  | 'resource.css'
  | 'resource.iframe'
  | 'resource.img'
  | 'resource.link'
  | 'resource.other'
  | 'resource.script'
> {
  return BaseFrame(fields.op ?? 'resource.other', {
    ...fields,
    data: {
      decodedBodySize: fields.data?.decodedBodySize ?? 0,
      encodedBodySize: fields.data?.encodedBodySize ?? 0,
      size: fields.data?.size ?? 0,
      statusCode: fields.data?.statusCode,
    },
  });
}
