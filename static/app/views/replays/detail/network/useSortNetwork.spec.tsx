import {act} from 'react-test-renderer';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import type {NetworkSpan} from 'sentry/views/replays/types';

import useSortNetwork from './useSortNetwork';

jest.mock('react-router');
jest.mock('sentry/utils/useUrlParams', () => {
  const map = new Map();
  return (name, dflt) => {
    if (!map.has(name)) {
      map.set(name, dflt);
    }
    return {
      getParamValue: () => map.get(name),
      setParamValue: value => {
        map.set(name, value);
      },
    };
  };
});

const SPAN_0_NAVIGATE = {
  id: '0',
  timestamp: 1663131080555.4,
  op: 'navigation.navigate',
  description: 'http://localhost:3000/',
  startTimestamp: 1663131080.5554,
  endTimestamp: 1663131080.6947,
  data: {
    size: 1334,
  },
};

const SPAN_1_LINK = {
  id: '1',
  timestamp: 1663131080576.7,
  op: 'resource.link',
  description: 'http://localhost:3000/static/css/main.1856e8e3.chunk.css',
  startTimestamp: 1663131080.5767,
  endTimestamp: 1663131080.5951,
  data: {
    size: 300,
  },
};

const SPAN_2_SCRIPT = {
  id: '2',
  timestamp: 1663131080577.0998,
  op: 'resource.script',
  description: 'http://localhost:3000/static/js/2.3b866bed.chunk.js',
  startTimestamp: 1663131080.5770998,
  endTimestamp: 1663131080.5979,
  data: {
    size: 300,
  },
};

const SPAN_3_FETCH = {
  id: '3',
  timestamp: 1663131080641,
  op: 'resource.fetch',
  description: 'https://pokeapi.co/api/v2/pokemon',
  startTimestamp: 1663131080.641,
  endTimestamp: 1663131080.65,
  data: {
    method: 'GET',
    statusCode: 200,
  },
};

const SPAN_4_IMG = {
  id: '4',
  timestamp: 1663131080642.2,
  op: 'resource.img',
  description: 'http://localhost:3000/static/media/logo.ddd5084d.png',
  startTimestamp: 1663131080.6422,
  endTimestamp: 1663131080.6441,
  data: {
    size: 300,
  },
};

const SPAN_5_CSS = {
  id: '5',
  timestamp: 1663131080644.7997,
  op: 'resource.css',
  description:
    'http://localhost:3000/static/media/glyphicons-halflings-regular.448c34a5.woff2',
  startTimestamp: 1663131080.6447997,
  endTimestamp: 1663131080.6548998,
  data: {
    size: 300,
  },
};

const SPAN_6_PUSH = {
  id: '6',
  timestamp: 1663131082346,
  op: 'navigation.push',
  description: '/mypokemon',
  startTimestamp: 1663131082.346,
  endTimestamp: 1663131082.346,
  data: {},
};

const SPAN_7_FETCH = {
  id: '7',
  timestamp: 1663131092471,
  op: 'resource.fetch',
  description: 'https://pokeapi.co/api/v2/pokemon/pikachu',
  startTimestamp: 1663131092.471,
  endTimestamp: 1663131092.48,
  data: {
    method: 'GET',
    statusCode: 200,
  },
};

const SPAN_8_FETCH = {
  id: '8',
  timestamp: 1663131120198,
  op: 'resource.fetch',
  description: 'https://pokeapi.co/api/v2/pokemon/mewtu',
  startTimestamp: 1663131120.198,
  endTimestamp: 1663131122.693,
  data: {
    method: 'GET',
    statusCode: 404,
  },
};

describe('useSortNetwork', () => {
  const items: NetworkSpan[] = [
    SPAN_0_NAVIGATE,
    SPAN_1_LINK,
    SPAN_2_SCRIPT,
    SPAN_3_FETCH,
    SPAN_4_IMG,
    SPAN_5_CSS,
    SPAN_6_PUSH,
    SPAN_7_FETCH,
    SPAN_8_FETCH,
  ];

  it('should the list by timestamp by default', () => {
    const {result} = reactHooks.renderHook(useSortNetwork, {
      initialProps: {items},
    });

    expect(result.current.sortConfig).toStrictEqual({
      by: 'startTimestamp',
      asc: true,
      getValue: expect.any(Function),
    });
    expect(result.current.items).toStrictEqual([
      SPAN_0_NAVIGATE,
      SPAN_1_LINK,
      SPAN_2_SCRIPT,
      SPAN_3_FETCH,
      SPAN_4_IMG,
      SPAN_5_CSS,
      SPAN_6_PUSH,
      SPAN_7_FETCH,
      SPAN_8_FETCH,
    ]);
  });

  it('should revese the sort order', () => {
    const {result, rerender} = reactHooks.renderHook(useSortNetwork, {
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
      SPAN_8_FETCH,
      SPAN_7_FETCH,
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
    const {result, rerender} = reactHooks.renderHook(useSortNetwork, {
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
      SPAN_8_FETCH,
      SPAN_7_FETCH,
    ]);
  });

  it('should sort by looking up the size field', () => {
    const {result, rerender} = reactHooks.renderHook(useSortNetwork, {
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
      SPAN_7_FETCH,
      SPAN_8_FETCH,
    ]);
  });
});
