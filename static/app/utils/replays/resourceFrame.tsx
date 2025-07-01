import invariant from 'invariant';

import type {RequestFrame, ResourceFrame, SpanFrame} from 'sentry/utils/replays/types';

export function isRequestFrame(frame: SpanFrame): frame is RequestFrame {
  return ['resource.fetch', 'resource.xhr', 'resource.http'].includes(frame.op);
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
  return isRequestFrame(frame) ? (frame.data.method ?? 'GET') : 'GET';
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

// Looks at conventions described in https://graphql.org/learn/serving-over-http/
// to infer if this is a GraphQL request, or GraphQL-like.
// The SDK must be configured to capture the request body.
export function isFrameGraphQLRequest(frame: SpanFrame): boolean {
  if (!isRequestFrame(frame) || !frame.data?.request) {
    return false;
  }

  const request = frame.data.request;
  const contentType = request.headers?.['content-type'] ?? '';

  // https://graphql.org/learn/serving-over-http/#headers
  // `application/graphql-response+json` is a good indicator
  if (contentType.includes('application/graphql-response+json')) {
    return true;
  }
  // Legacy servers required `application/json`
  if (!contentType.includes('application/json')) {
    return false;
  }

  try {
    const url = new URL(frame.description);
    const hasUrlQuery = Boolean(url.searchParams.get('query'));
    if (hasUrlQuery) {
      return true;
    }
  } catch {
    //
  }

  try {
    const bodyJson =
      typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const hasBodyQuery = 'query' in bodyJson;
    if (hasBodyQuery) {
      return true;
    }
  } catch {
    //
  }
  return false;
}

export function getGraphQLDescription(frame: SpanFrame) {
  if (!isRequestFrame(frame) || !isFrameGraphQLRequest(frame)) {
    return undefined;
  }

  try {
    const url = new URL(frame.description);
    if (url.searchParams.has('operationName')) {
      return `${frame.description} (${url.searchParams.get('operationName')})`;
    }

    const query = url.searchParams.get('query');
    if (query) {
      const operation = parseGraphQLQuery(query);
      if (operation) {
        return `${frame.description} (${operation.type} ${operation.name})`;
      }
    }
  } catch {
    //
  }

  try {
    const request = frame.data.request;
    invariant(request, 'For Typescript. isFrameGraphQLRequest() guards this already');
    const bodyJson =
      typeof request.body === 'string' ? JSON.parse(request.body) : request.body;

    if (bodyJson.operationName) {
      return `${frame.description} (${bodyJson.operationName})`;
    }
    const query = bodyJson.query;
    if (query) {
      const operation = parseGraphQLQuery(query);
      if (operation) {
        return `${frame.description} (${operation.type} ${operation.name})`;
      }
    }
  } catch {
    //
  }
  return undefined;
}

const queryRegExp = /(query|mutation|subscription)\s+([\w]+)/i;
function parseGraphQLQuery(query: string): {name: string; type: string} | undefined {
  const match = query.match(queryRegExp);
  if (match) {
    return {type: match[1]!, name: match[2]!};
  }
  return undefined;
}
