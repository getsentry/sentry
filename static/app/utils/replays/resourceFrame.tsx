import type {RequestFrame, ResourceFrame, SpanFrame} from 'sentry/utils/replays/types';

export function isRequestFrame(frame: SpanFrame): frame is RequestFrame {
  return ['resource.fetch', 'resource.xhr'].includes(frame.op);
}

function isResourceFrame(frame: SpanFrame): frame is ResourceFrame {
  return [
    'resource.css',
    'resource.iframe',
    'resource.img',
    'resource.link',
    'resource.other',
    'resource.script',
  ].includes(frame.op);
}

export function getFrameMethod(frame: SpanFrame) {
  return isRequestFrame(frame) ? frame.data.method ?? 'GET' : 'GET';
}

export function getFrameStatus(frame: SpanFrame) {
  return isRequestFrame(frame)
    ? frame.data.statusCode
    : isResourceFrame(frame)
    ? frame.data.statusCode
    : undefined;
}

export function getReqRespContentTypes(frame: SpanFrame) {
  if (isRequestFrame(frame)) {
    return {
      req: frame.data.request?.headers?.['content-type'],
      resp: frame.data.response?.headers?.['content-type'],
    };
  }
  return {
    req: undefined,
    resp: undefined,
  };
}

export function getResponseBodySize(frame: SpanFrame) {
  if (isRequestFrame(frame)) {
    // `data.responseBodySize` is from SDK version 7.44-7.45
    return frame.data.response?.size ?? frame.data.responseBodySize;
  }
  if (isResourceFrame(frame)) {
    // What about these?
    //   frame.data.decodedBodySize
    //   frame.data.encodedBodySize
    return frame.data.size;
  }
  return undefined;
}
