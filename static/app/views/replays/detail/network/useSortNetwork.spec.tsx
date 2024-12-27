import {
  ReplayNavigationFrameFixture,
  ReplayNavigationPushFrameFixture,
  ReplayRequestFrameFixture,
  ReplayResourceFrameFixture,
} from 'sentry-fixture/replay/replaySpanFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import hydrateSpans from 'sentry/utils/replays/hydrateSpans';

import useSortNetwork from './useSortNetwork';

jest.mock('sentry/utils/useUrlParams', () => {
  const map = new Map();
  return (name: string, dflt: string) => {
    if (!map.has(name)) {
      map.set(name, dflt);
    }
    return {
      getParamValue: () => map.get(name),
      setParamValue: (value: string) => {
        map.set(name, value);
      },
    };
  };
});

const [
  SPAN_0_NAVIGATE,
  SPAN_1_LINK,
  SPAN_2_SCRIPT,
  SPAN_3_FETCH,
  SPAN_4_IMG,
  SPAN_5_CSS,
  SPAN_6_PUSH,
  SPAN_7_FETCH_GET,
  SPAN_8_FETCH_POST,
] = hydrateSpans(ReplayRecordFixture(), [
  ReplayNavigationFrameFixture({
    op: 'navigation.navigate',
    description: 'http://localhost:3000/',
    startTimestamp: new Date(1663131080.5554),
    endTimestamp: new Date(1663131080.6947),
    data: {
      size: 1334,
    },
  }),
  ReplayResourceFrameFixture({
    op: 'resource.link',
    description: 'http://localhost:3000/static/css/main.1856e8e3.chunk.css',
    startTimestamp: new Date(1663131080.5767),
    endTimestamp: new Date(1663131080.5951),
  }),
  ReplayResourceFrameFixture({
    op: 'resource.script',
    description: 'http://localhost:3000/static/js/2.3b866bed.chunk.js',
    startTimestamp: new Date(1663131080.5770998),
    endTimestamp: new Date(1663131080.5979),
  }),
  ReplayRequestFrameFixture({
    op: 'resource.fetch',
    description: 'https://pokeapi.co/api/v2/pokemon',
    startTimestamp: new Date(1663131080.641),
    endTimestamp: new Date(1663131080.65),
    data: {
      method: 'GET',
      statusCode: 200,
    },
  }),
  ReplayResourceFrameFixture({
    op: 'resource.img',
    description: 'http://localhost:3000/static/media/logo.ddd5084d.png',
    startTimestamp: new Date(1663131080.6422),
    endTimestamp: new Date(1663131080.6441),
  }),
  ReplayResourceFrameFixture({
    op: 'resource.css',
    description:
      'http://localhost:3000/static/media/glyphicons-halflings-regular.448c34a5.woff2',
    startTimestamp: new Date(1663131080.6447997),
    endTimestamp: new Date(1663131080.6548998),
  }),
  ReplayNavigationPushFrameFixture({
    op: 'navigation.push',
    description: '/mypokemon',
    startTimestamp: new Date(1663131082.346),
    endTimestamp: new Date(1663131082.346),
  }),
  ReplayRequestFrameFixture({
    op: 'resource.fetch',
    description: 'https://pokeapi.co/api/v2/pokemon/pikachu',
    startTimestamp: new Date(1663131092.471),
    endTimestamp: new Date(1663131092.48),
    data: {
      method: 'GET',
      statusCode: 200,
    },
  }),
  ReplayRequestFrameFixture({
    op: 'resource.fetch',
    description: 'https://pokeapi.co/api/v2/pokemon/mewtu',
    startTimestamp: new Date(1663131120.198),
    endTimestamp: new Date(1663131122.693),
    data: {
      method: 'POST',
      statusCode: 404,
    },
  }),
]);

describe('useSortNetwork', () => {
  const items = [
    SPAN_0_NAVIGATE,
    SPAN_1_LINK,
    SPAN_2_SCRIPT,
    SPAN_3_FETCH,
    SPAN_4_IMG,
    SPAN_5_CSS,
    SPAN_6_PUSH,
    SPAN_7_FETCH_GET,
    SPAN_8_FETCH_POST,
  ];

  it('should the list by timestamp by default', () => {
    const {result} = renderHook(useSortNetwork, {
      initialProps: {items},
    });

    expect(result.current.sortConfig).toStrictEqual({
      by: 'startTimestamp',
      asc: true,
      getValue: expect.any(Function),
    });
    expect(result.current.items).toStrictEqual([
      SPAN_5_CSS,
      SPAN_4_IMG,
      SPAN_3_FETCH,
      SPAN_2_SCRIPT,
      SPAN_1_LINK,
      SPAN_0_NAVIGATE,
      SPAN_6_PUSH,
      SPAN_7_FETCH_GET,
      SPAN_8_FETCH_POST,
    ]);
  });

  it('should reverse the sort order', () => {
    const {result, rerender} = renderHook(useSortNetwork, {
      initialProps: {items},
    });

    act(() => {
      result.current.handleSort('startTimestamp');
    });

    rerender({items});

    expect(result.current.sortConfig).toStrictEqual({
      by: 'startTimestamp',
      asc: false,
      getValue: expect.any(Function),
    });
    expect(result.current.items).toStrictEqual([
      SPAN_8_FETCH_POST,
      SPAN_7_FETCH_GET,
      SPAN_6_PUSH,
      SPAN_5_CSS,
      SPAN_4_IMG,
      SPAN_3_FETCH,
      SPAN_2_SCRIPT,
      SPAN_1_LINK,
      SPAN_0_NAVIGATE,
    ]);
  });

  it('should sort by the description field', () => {
    const {result, rerender} = renderHook(useSortNetwork, {
      initialProps: {items},
    });

    act(() => {
      result.current.handleSort('description');
    });

    rerender({items});

    expect(result.current.sortConfig).toStrictEqual({
      by: 'description',
      asc: true,
      getValue: expect.any(Function),
    });
    expect(result.current.items).toStrictEqual([
      SPAN_6_PUSH,
      SPAN_0_NAVIGATE,
      SPAN_1_LINK,
      SPAN_2_SCRIPT,
      SPAN_5_CSS,
      SPAN_4_IMG,
      SPAN_3_FETCH,
      SPAN_8_FETCH_POST,
      SPAN_7_FETCH_GET,
    ]);
  });

  it('should sort by looking up the size field', () => {
    const {result, rerender} = renderHook(useSortNetwork, {
      initialProps: {items},
    });

    act(() => {
      result.current.handleSort('size');
    });

    rerender({items});

    expect(result.current.sortConfig).toStrictEqual({
      by: 'size',
      asc: true,
      getValue: expect.any(Function),
    });
    expect(result.current.items).toStrictEqual([
      SPAN_1_LINK,
      SPAN_2_SCRIPT,
      SPAN_4_IMG,
      SPAN_5_CSS,
      SPAN_0_NAVIGATE,
      SPAN_3_FETCH,
      SPAN_6_PUSH,
      SPAN_7_FETCH_GET,
      SPAN_8_FETCH_POST,
    ]);
  });

  it('should sort by method, using GET as a default', () => {
    const mixedItems = [SPAN_6_PUSH, SPAN_8_FETCH_POST, SPAN_7_FETCH_GET];
    const {result, rerender} = renderHook(useSortNetwork, {
      initialProps: {items: mixedItems},
    });

    act(() => {
      result.current.handleSort('method');
    });

    rerender({items: mixedItems});

    expect(result.current.sortConfig).toStrictEqual({
      by: 'method',
      asc: true,
      getValue: expect.any(Function),
    });
    expect(result.current.items).toStrictEqual([
      SPAN_6_PUSH,
      SPAN_7_FETCH_GET,
      SPAN_8_FETCH_POST,
    ]);

    act(() => {
      result.current.handleSort('method');
    });

    rerender({items: mixedItems});

    expect(result.current.sortConfig).toStrictEqual({
      by: 'method',
      asc: false,
      getValue: expect.any(Function),
    });
    expect(result.current.items).toStrictEqual([
      SPAN_8_FETCH_POST,
      SPAN_6_PUSH,
      SPAN_7_FETCH_GET,
    ]);
  });
});
