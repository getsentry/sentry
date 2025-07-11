import {
  ReplayRequestFrameFixture,
  ReplayResourceFrameFixture,
} from 'sentry-fixture/replay/replaySpanFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import hydrateSpans from 'sentry/utils/replays/hydrateSpans';
import {isFrameMaybeGraphQLRequest} from 'sentry/utils/replays/resourceFrame';

describe('isFrameGraphQLRequest', () => {
  it('should return false for resource requests', () => {
    const frames = hydrateSpans(ReplayRecordFixture(), [
      ReplayResourceFrameFixture({
        op: 'resource.css',
        startTimestamp: new Date(10000),
        endTimestamp: new Date(30000),
      }),
    ]);
    expect(isFrameMaybeGraphQLRequest(frames[0]!)).toBeFalsy();
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
    expect(isFrameMaybeGraphQLRequest(frames[0]!)).toBeFalsy();
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
    expect(isFrameMaybeGraphQLRequest(frames[0]!)).toBeFalsy();
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
    expect(isFrameMaybeGraphQLRequest(frames[0]!)).toBeFalsy();
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
    expect(isFrameMaybeGraphQLRequest(frames[0]!)).toBeTruthy();
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
    expect(isFrameMaybeGraphQLRequest(frames[0]!)).toBeFalsy();
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
    expect(isFrameMaybeGraphQLRequest(frames[0]!)).toBeTruthy();
  });

  it('should return true when a GET request has only known query parameters', () => {
    const frames = hydrateSpans(ReplayRecordFixture(), [
      ReplayRequestFrameFixture({
        op: 'resource.fetch',
        startTimestamp: new Date(10000),
        endTimestamp: new Date(30000),
        description:
          'https://example.com?query=123&operationName=123&variables=123&extensions=123',
        data: {
          request: {
            headers: {
              'content-type': 'application/json',
            },
          },
        },
      }),
    ]);
    expect(isFrameMaybeGraphQLRequest(frames[0]!)).toBeTruthy();
  });

  it('should return false when a GET request has query and also random query parameters', () => {
    const frames = hydrateSpans(ReplayRecordFixture(), [
      ReplayRequestFrameFixture({
        op: 'resource.fetch',
        startTimestamp: new Date(10000),
        endTimestamp: new Date(30000),
        description: 'https://example.com?query=123&random=123',
        data: {
          request: {
            headers: {
              'content-type': 'application/json',
            },
          },
        },
      }),
    ]);
    expect(isFrameMaybeGraphQLRequest(frames[0]!)).toBeFalsy();
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
    expect(isFrameMaybeGraphQLRequest(frames[0]!)).toBeTruthy();
  });

  it('should return true when a POST request has a `query` in the body and only known fields', () => {
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
            body: JSON.stringify({
              query: '123',
              operationName: '123',
              variables: '123',
              extensions: '123',
            }),
          },
        },
      }),
    ]);
    expect(isFrameMaybeGraphQLRequest(frames[0]!)).toBeTruthy();
  });

  it('should return false when a POST request has a `query` in the body along with random fields', () => {
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
            body: JSON.stringify({
              query: '123',
              random: '123',
            }),
          },
        },
      }),
    ]);
    expect(isFrameMaybeGraphQLRequest(frames[0]!)).toBeFalsy();
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
    expect(isFrameMaybeGraphQLRequest(frames[0]!)).toBeTruthy();
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
    expect(isFrameMaybeGraphQLRequest(frames[0]!)).toBeTruthy();
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
    expect(isFrameMaybeGraphQLRequest(frames[0]!)).toBeFalsy();
  });
});
