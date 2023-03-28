import {browserHistory} from 'react-router';
import type {Location} from 'history';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import type {NetworkSpan} from 'sentry/views/replays/types';

import useNetworkFilters, {FilterFields} from './useNetworkFilters';

jest.mock('react-router');
jest.mock('sentry/utils/useLocation');

const mockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>;
const mockBrowserHistoryPush = browserHistory.push as jest.MockedFunction<
  typeof browserHistory.push
>;

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

describe('useNetworkFilters', () => {
  const networkSpans: NetworkSpan[] = [
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

  beforeEach(() => {
    mockBrowserHistoryPush.mockReset();
  });

  it('should update the url when setters are called', () => {
    const TYPE_FILTER = ['resource.fetch'];
    const STATUS_FILTER = ['200'];
    const SEARCH_FILTER = 'pikachu';

    mockUseLocation
      .mockReturnValueOnce({
        pathname: '/',
        query: {},
      } as Location<FilterFields>)
      .mockReturnValueOnce({
        pathname: '/',
        query: {f_n_type: TYPE_FILTER},
      } as Location<FilterFields>)
      .mockReturnValueOnce({
        pathname: '/',
        query: {f_n_type: TYPE_FILTER, f_n_status: STATUS_FILTER},
      } as Location<FilterFields>);

    const {result, rerender} = reactHooks.renderHook(useNetworkFilters, {
      initialProps: {networkSpans},
    });

    result.current.setType(TYPE_FILTER);
    expect(browserHistory.push).toHaveBeenLastCalledWith({
      pathname: '/',
      query: {
        f_n_type: TYPE_FILTER,
      },
    });

    rerender();

    result.current.setStatus(STATUS_FILTER);
    expect(browserHistory.push).toHaveBeenLastCalledWith({
      pathname: '/',
      query: {
        f_n_type: TYPE_FILTER,
        f_n_status: STATUS_FILTER,
      },
    });

    rerender();

    result.current.setSearchTerm(SEARCH_FILTER);
    expect(browserHistory.push).toHaveBeenLastCalledWith({
      pathname: '/',
      query: {
        f_n_type: TYPE_FILTER,
        f_n_status: STATUS_FILTER,
        f_n_search: SEARCH_FILTER,
      },
    });
  });

  it('should clear details params when setters are called', () => {
    const TYPE_FILTER = ['resource.fetch'];
    const STATUS_FILTER = ['200'];
    const SEARCH_FILTER = 'pikachu';

    mockUseLocation
      .mockReturnValueOnce({
        pathname: '/',
        query: {
          n_detail_row: 0,
          n_detail_tab: 'response',
        },
      } as Location<FilterFields>)
      .mockReturnValueOnce({
        pathname: '/',
        query: {f_n_type: TYPE_FILTER, n_detail_row: 0, n_detail_tab: 'response'},
      } as Location<FilterFields>)
      .mockReturnValueOnce({
        pathname: '/',
        query: {
          f_n_type: TYPE_FILTER,
          f_n_status: STATUS_FILTER,
          n_detail_row: 0,
          n_detail_tab: 'response',
        },
      } as Location<FilterFields>);

    const {result, rerender} = reactHooks.renderHook(useNetworkFilters, {
      initialProps: {networkSpans},
    });

    result.current.setType(TYPE_FILTER);
    expect(browserHistory.push).toHaveBeenLastCalledWith({
      pathname: '/',
      query: {
        f_n_type: TYPE_FILTER,
      },
    });

    rerender();

    result.current.setStatus(STATUS_FILTER);
    expect(browserHistory.push).toHaveBeenLastCalledWith({
      pathname: '/',
      query: {
        f_n_type: TYPE_FILTER,
        f_n_status: STATUS_FILTER,
      },
    });

    rerender();

    result.current.setSearchTerm(SEARCH_FILTER);
    expect(browserHistory.push).toHaveBeenLastCalledWith({
      pathname: '/',
      query: {
        f_n_type: TYPE_FILTER,
        f_n_status: STATUS_FILTER,
        f_n_search: SEARCH_FILTER,
      },
    });
  });

  it('should not filter anything when no values are set', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {},
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(useNetworkFilters, {
      initialProps: {networkSpans},
    });
    expect(result.current.items.length).toEqual(9);
  });

  it('should filter by status', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_n_status: ['200'],
      },
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(useNetworkFilters, {
      initialProps: {networkSpans},
    });
    expect(result.current.items.length).toEqual(2);
  });

  it('should filter by type', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_n_type: ['resource.fetch'],
      },
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(useNetworkFilters, {
      initialProps: {networkSpans},
    });
    expect(result.current.items.length).toEqual(3);
  });

  it('should filter by searchTerm', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_n_search: 'pikachu',
      },
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(useNetworkFilters, {
      initialProps: {networkSpans},
    });
    expect(result.current.items.length).toEqual(1);
  });

  it('should filter by type, searchTerm and logLevel', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_n_status: ['200'],
        f_n_type: ['resource.fetch'],
        f_n_search: 'pokemon/',
      },
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(useNetworkFilters, {
      initialProps: {networkSpans},
    });
    expect(result.current.items.length).toEqual(1);
  });
});

describe('getResourceTypes', () => {
  it('should default to having fetch in the list of span types', () => {
    const networkSpans = [];

    const {result} = reactHooks.renderHook(useNetworkFilters, {
      initialProps: {networkSpans},
    });

    expect(result.current.getResourceTypes()).toStrictEqual([
      {label: 'fetch', value: 'resource.fetch'},
    ]);
  });

  it('should return a sorted list of BreadcrumbType', () => {
    const networkSpans = [SPAN_0_NAVIGATE, SPAN_1_LINK, SPAN_2_SCRIPT];

    const {result} = reactHooks.renderHook(useNetworkFilters, {
      initialProps: {networkSpans},
    });

    expect(result.current.getResourceTypes()).toStrictEqual([
      {label: 'fetch', value: 'resource.fetch'},
      {label: 'link', value: 'resource.link'},
      {label: 'navigate', value: 'navigation.navigate'},
      {label: 'script', value: 'resource.script'},
    ]);
  });

  it('should deduplicate BreadcrumbType', () => {
    const networkSpans = [
      SPAN_0_NAVIGATE,
      SPAN_1_LINK,
      SPAN_2_SCRIPT,
      SPAN_3_FETCH,
      SPAN_7_FETCH,
    ];

    const {result} = reactHooks.renderHook(useNetworkFilters, {
      initialProps: {networkSpans},
    });

    expect(result.current.getResourceTypes()).toStrictEqual([
      {label: 'fetch', value: 'resource.fetch'},
      {label: 'link', value: 'resource.link'},
      {label: 'navigate', value: 'navigation.navigate'},
      {label: 'script', value: 'resource.script'},
    ]);
  });
});

describe('getStatusTypes', () => {
  it('should return a sorted list of BreadcrumbType', () => {
    const networkSpans = [SPAN_0_NAVIGATE, SPAN_1_LINK, SPAN_2_SCRIPT, SPAN_8_FETCH];

    const {result} = reactHooks.renderHook(useNetworkFilters, {
      initialProps: {networkSpans},
    });

    expect(result.current.getStatusTypes()).toStrictEqual([
      {
        label: '200',
        value: '200',
      },
      {label: '404', value: '404'},
      {label: 'unknown', value: 'unknown'},
    ]);
  });

  it('should deduplicate BreadcrumbType', () => {
    const networkSpans = [
      SPAN_0_NAVIGATE,
      SPAN_1_LINK,
      SPAN_2_SCRIPT,
      SPAN_3_FETCH,
      SPAN_7_FETCH,
      SPAN_8_FETCH,
    ];

    const {result} = reactHooks.renderHook(useNetworkFilters, {
      initialProps: {networkSpans},
    });

    expect(result.current.getStatusTypes()).toStrictEqual([
      {
        label: '200',
        value: '200',
      },
      {label: '404', value: '404'},
      {label: 'unknown', value: 'unknown'},
    ]);
  });
});
