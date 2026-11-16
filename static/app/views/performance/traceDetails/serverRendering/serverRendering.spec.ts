import {
  SEARCH_PAGE__SERVER_RENDERING__TYPE,
  SEARCH_SENTRY__LINK__TYPE,
} from '@sentry/conventions/attributes/search';

import type {
  TraceItemResponseAttribute,
  TraceItemResponseLink,
} from 'sentry/views/explore/hooks/useTraceItemDetails';

import {getPageServerRendering} from './serverRendering';

function typeAttribute(value: string): TraceItemResponseAttribute[] {
  return [{name: SEARCH_PAGE__SERVER_RENDERING__TYPE, type: 'str', value}];
}

function makeLink(
  type: string,
  overrides: Partial<TraceItemResponseLink> = {}
): TraceItemResponseLink {
  return {
    itemId: 'b415e097df49bf1c',
    traceId: '6edf623ed48e4172a54e7fbee3b40c5d',
    sampled: true,
    attributes: [{name: SEARCH_SENTRY__LINK__TYPE, type: 'str', value: type}],
    ...overrides,
  };
}

describe('getPageServerRendering', () => {
  it('returns null for a span that is not a pageload', () => {
    const result = getPageServerRendering({
      op: 'http.server',
      attributes: typeAttribute('static'),
      links: [makeLink('cache_origin')],
    });

    expect(result).toBeNull();
  });

  it('returns null for a pageload whose links are not about server rendering', () => {
    const result = getPageServerRendering({
      op: 'pageload',
      attributes: [],
      links: [makeLink('previous_trace')],
    });

    expect(result).toBeNull();
  });

  it('returns null for a type value that SDKs do not set, such as dynamic', () => {
    const result = getPageServerRendering({
      op: 'pageload',
      attributes: typeAttribute('dynamic'),
    });

    expect(result).toBeNull();
  });

  it('returns the whole page as a shared render in the linked trace for a static page', () => {
    const cacheOrigin = makeLink('cache_origin');

    const result = getPageServerRendering({
      op: 'pageload',
      attributes: typeAttribute('static'),
      links: [cacheOrigin],
    });

    expect(result).toEqual({
      type: 'static',
      sharedRender: {
        part: 'whole_page',
        location: {type: 'other_trace', link: cacheOrigin},
      },
      requestRender: undefined,
    });
  });

  it('marks the shared render as not traced when a static page has no link', () => {
    const result = getPageServerRendering({
      op: 'pageload',
      attributes: typeAttribute('static'),
    });

    expect(result).toEqual({
      type: 'static',
      sharedRender: {part: 'whole_page', location: {type: 'not_traced'}},
      requestRender: undefined,
    });
  });

  it('marks a link to an unsampled render as not sampled', () => {
    const cacheOrigin = makeLink('cache_origin', {sampled: false});

    const result = getPageServerRendering({
      op: 'pageload',
      attributes: typeAttribute('static'),
      links: [cacheOrigin],
    });

    expect(result?.sharedRender).toEqual({
      part: 'whole_page',
      location: {type: 'not_sampled', link: cacheOrigin},
    });
  });

  it('treats a link without a sampling decision as sampled', () => {
    const cacheOrigin = makeLink('cache_origin', {sampled: undefined});

    const result = getPageServerRendering({
      op: 'pageload',
      attributes: typeAttribute('static'),
      links: [cacheOrigin],
    });

    expect(result?.sharedRender).toEqual({
      part: 'whole_page',
      location: {type: 'other_trace', link: cacheOrigin},
    });
  });

  it('puts the dynamic part of a partially static page in this trace', () => {
    const cacheOrigin = makeLink('cache_origin');

    const result = getPageServerRendering({
      op: 'pageload',
      attributes: typeAttribute('partially_static'),
      links: [cacheOrigin],
    });

    expect(result).toEqual({
      type: 'partially_static',
      sharedRender: {
        part: 'static_part',
        location: {type: 'other_trace', link: cacheOrigin},
      },
      requestRender: {location: {type: 'this_trace'}},
    });
  });

  it('puts the dynamic part in the linked trace when its trace context arrived late', () => {
    const serverRequest = makeLink('server_request', {
      traceId: '7fe0734fe59f5283b65f8acff4c51d6e',
    });

    const result = getPageServerRendering({
      op: 'pageload',
      attributes: typeAttribute('partially_static'),
      links: [makeLink('cache_origin'), serverRequest],
    });

    expect(result?.requestRender).toEqual({
      location: {type: 'other_trace', link: serverRequest},
    });
  });

  it('returns a shared render of an unknown part when only the link says the page was reused', () => {
    const cacheOrigin = makeLink('cache_origin');
    const serverRequest = makeLink('server_request', {
      traceId: '7fe0734fe59f5283b65f8acff4c51d6e',
    });

    const result = getPageServerRendering({
      op: 'pageload',
      attributes: [],
      links: [serverRequest, cacheOrigin],
    });

    expect(result).toEqual({
      type: undefined,
      sharedRender: {part: undefined, location: {type: 'other_trace', link: cacheOrigin}},
      requestRender: {location: {type: 'other_trace', link: serverRequest}},
    });
  });

  it('returns only the request render for a late trace context without reuse', () => {
    const serverRequest = makeLink('server_request', {sampled: false});

    const result = getPageServerRendering({
      op: 'pageload',
      attributes: [],
      links: [serverRequest],
    });

    expect(result).toEqual({
      type: undefined,
      sharedRender: undefined,
      requestRender: {location: {type: 'not_sampled', link: serverRequest}},
    });
  });
});
