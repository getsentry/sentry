import {
  ReplayRequestFrameFixture,
  ReplayResourceFrameFixture,
} from 'sentry-fixture/replay/replaySpanFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import hydrateSpans from 'sentry/utils/replays/hydrateSpans';
import {isFrameGraphQLRequest} from 'sentry/utils/replays/resourceFrame';

describe('isFrameGraphQLRequest', () => {
  it('should return false for resource requests', () => {
    const frames = hydrateSpans(ReplayRecordFixture(), [
      ReplayResourceFrameFixture({
        op: 'resource.css',
        startTimestamp: new Date(10000),
        endTimestamp: new Date(30000),
      }),
    ]);
    expect(isFrameGraphQLRequest(frames[0]!)).toBeFalsy();
  });

  it('should return false when the request body is missing', () => {
    const frames = hydrateSpans(ReplayRecordFixture(), [
      ReplayRequestFrameFixture({
        op: 'resource.fetch',
        startTimestamp: new Date(10000),
        endTimestamp: new Date(30000),
        data: {},
      }),
    ]);
    expect(isFrameGraphQLRequest(frames[0]!)).toBeFalsy();
  });

  it('should return false when content-type is undefined', () => {
    const frames = hydrateSpans(ReplayRecordFixture(), [
      ReplayRequestFrameFixture({
        op: 'resource.fetch',
        startTimestamp: new Date(10000),
        endTimestamp: new Date(30000),
        data: {
          request: {
            headers: {},
          },
        },
      }),
    ]);
    expect(isFrameGraphQLRequest(frames[0]!)).toBeFalsy();
  });

  it('should return false when content-type is not application/json', () => {
    const frames = hydrateSpans(ReplayRecordFixture(), [
      ReplayRequestFrameFixture({
        op: 'resource.fetch',
        startTimestamp: new Date(10000),
        endTimestamp: new Date(30000),
        data: {
          request: {
            headers: {
              'content-type': 'application/img',
            },
          },
        },
      }),
    ]);
    expect(isFrameGraphQLRequest(frames[0]!)).toBeFalsy();
  });

  it('should return true when content-type is application/graphql-response+json', () => {
    const frames = hydrateSpans(ReplayRecordFixture(), [
      ReplayRequestFrameFixture({
        op: 'resource.fetch',
        startTimestamp: new Date(10000),
        endTimestamp: new Date(30000),
        data: {
          request: {
            headers: {
              'content-type': 'application/graphql-response+json',
            },
          },
        },
      }),
    ]);
    expect(isFrameGraphQLRequest(frames[0]!)).toBeTruthy();
  });

  it('should return false when the request is missing a `query`', () => {
    const frames = hydrateSpans(ReplayRecordFixture(), [
      ReplayRequestFrameFixture({
        op: 'resource.fetch',
        startTimestamp: new Date(10000),
        endTimestamp: new Date(30000),
        data: {
          request: {
            headers: {
              'content-type': 'application/app',
            },
          },
        },
      }),
    ]);
    expect(isFrameGraphQLRequest(frames[0]!)).toBeFalsy();
  });

  it('should return true when a GET request has a `query` parameter', () => {
    const frames = hydrateSpans(ReplayRecordFixture(), [
      ReplayRequestFrameFixture({
        op: 'resource.fetch',
        startTimestamp: new Date(10000),
        endTimestamp: new Date(30000),
        description: 'https://example.com?query=123',
        data: {
          request: {
            headers: {
              'content-type': 'application/json',
            },
          },
        },
      }),
    ]);
    expect(isFrameGraphQLRequest(frames[0]!)).toBeTruthy();
  });

  it('should return true when a POST request has a `query` in the body', () => {
    const frames = hydrateSpans(ReplayRecordFixture(), [
      ReplayRequestFrameFixture({
        op: 'resource.fetch',
        startTimestamp: new Date(10000),
        endTimestamp: new Date(30000),
        description: 'https://example.com',
        data: {
          request: {
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({query: '123'}),
          },
        },
      }),
    ]);
    expect(isFrameGraphQLRequest(frames[0]!)).toBeTruthy();
  });

  it('should not care if the a body is invalid when the url has ?query', () => {
    const frames = hydrateSpans(ReplayRecordFixture(), [
      ReplayRequestFrameFixture({
        op: 'resource.fetch',
        startTimestamp: new Date(10000),
        endTimestamp: new Date(30000),
        description: 'https://example.com?query=123',
        data: {
          request: {
            headers: {
              'content-type': 'application/json',
            },
            body: 'not json',
          },
        },
      }),
    ]);
    expect(isFrameGraphQLRequest(frames[0]!)).toBeTruthy();
  });

  it('should skip invalid urls and only check bodies', () => {
    const frames = hydrateSpans(ReplayRecordFixture(), [
      ReplayRequestFrameFixture({
        op: 'resource.fetch',
        startTimestamp: new Date(10000),
        endTimestamp: new Date(30000),
        description: 'foo-bar-baz',
        data: {
          request: {
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({query: '123'}),
          },
        },
      }),
    ]);
    expect(isFrameGraphQLRequest(frames[0]!)).toBeTruthy();
  });

  it('should not throw when the url and body are invalid values', () => {
    const frames = hydrateSpans(ReplayRecordFixture(), [
      ReplayRequestFrameFixture({
        op: 'resource.fetch',
        startTimestamp: new Date(10000),
        endTimestamp: new Date(30000),
        description: 'foo-bar-baz',
        data: {
          request: {
            headers: {
              'content-type': 'application/json',
            },
            body: 'not json',
          },
        },
      }),
    ]);
    expect(isFrameGraphQLRequest(frames[0]!)).toBeFalsy();
  });
});
