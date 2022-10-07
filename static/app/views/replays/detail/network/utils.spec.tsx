import type {NetworkSpan} from 'sentry/views/replays/types';

import {getResourceTypes, getStatusTypes} from './utils';

describe('getResourceTypes', () => {
  const SPAN_NAVIGATE = {op: 'navigation.navigate'} as NetworkSpan;
  const SPAN_FETCH = {op: 'resource.fetch'} as NetworkSpan;
  const SPAN_PUSH = {op: 'navigation.push'} as NetworkSpan;

  it('should return a sorted list of BreadcrumbType', () => {
    const spans = [SPAN_NAVIGATE, SPAN_FETCH, SPAN_PUSH];
    expect(getResourceTypes(spans)).toStrictEqual([
      'fetch',
      'navigation.navigate',
      'navigation.push',
    ]);
  });

  it('should deduplicate BreadcrumbType', () => {
    const spans = [SPAN_FETCH, SPAN_FETCH];
    expect(getResourceTypes(spans)).toStrictEqual(['fetch']);
  });
});

describe('getStatusTypes', () => {
  const SPAN_200 = {data: {statusCode: 200}} as unknown as NetworkSpan;
  const SPAN_404 = {data: {statusCode: 404}} as unknown as NetworkSpan;
  const SPAN_UNKNOWN = {data: {statusCode: undefined}} as unknown as NetworkSpan;

  it('should return a sorted list of BreadcrumbType', () => {
    const spans = [SPAN_200, SPAN_404, SPAN_UNKNOWN];
    expect(getStatusTypes(spans)).toStrictEqual(['200', '404', 'unknown']);
  });

  it('should deduplicate BreadcrumbType', () => {
    const spans = [SPAN_200, SPAN_200];
    expect(getStatusTypes(spans)).toStrictEqual(['200']);
  });
});
