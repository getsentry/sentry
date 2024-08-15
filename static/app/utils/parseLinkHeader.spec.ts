import parseLinkHeader from 'sentry/utils/parseLinkHeader';

describe('parseLinkHeader', () => {
  it('should extract next & prev links from a string', () => {
    const linkHeader =
      '<https://us.sentry.io/api/0/organizations/sentry/replays/?per_page=50&queryReferrer=replayList&cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", <https://us.sentry.io/api/0/organizations/sentry/replays/?per_page=50&queryReferrer=replayList&cursor=0:50:0>; rel="next"; results="true"; cursor="0:50:0"';

    const parsed = parseLinkHeader(linkHeader);

    expect(parsed).toStrictEqual({
      previous: {
        href: 'https://us.sentry.io/api/0/organizations/sentry/replays/?per_page=50&queryReferrer=replayList&cursor=0:0:1',
        results: false,
        cursor: '0:0:1',
      },
      next: {
        href: 'https://us.sentry.io/api/0/organizations/sentry/replays/?per_page=50&queryReferrer=replayList&cursor=0:50:0',
        results: true,
        cursor: '0:50:0',
      },
    });
  });

  it('will not return anything if the string cannot be parsed', () => {
    const parsed = parseLinkHeader('hell world');

    expect(parsed).toStrictEqual({});
  });

  it('should extract only next or prev when only one exists', () => {
    const prevOnly =
      '<https://us.sentry.io/api/0/organizations/sentry/replays/?per_page=50&queryReferrer=replayList&cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1"';

    const parsed = parseLinkHeader(prevOnly);

    expect(parsed).toStrictEqual({
      previous: {
        href: 'https://us.sentry.io/api/0/organizations/sentry/replays/?per_page=50&queryReferrer=replayList&cursor=0:0:1',
        results: false,
        cursor: '0:0:1',
      },
    });
  });

  it('will return any keys that are provided in the "rel" field', () => {
    const prevOnly =
      '<http://example.com>; rel="foo"; results="false"; cursor="0:0:1", <http://example.com>; rel="bar"; results="false"; cursor="0:0:1"';

    const parsed = parseLinkHeader(prevOnly);

    expect(parsed).toStrictEqual({
      foo: {
        href: 'http://example.com',
        results: false,
        cursor: '0:0:1',
      },
      bar: {
        href: 'http://example.com',
        results: false,
        cursor: '0:0:1',
      },
    });
  });
});
