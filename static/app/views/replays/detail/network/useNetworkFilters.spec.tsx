import {browserHistory} from 'react-router';
import type {Location} from 'history';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import {NetworkSpan} from 'sentry/views/replays/detail/network/utils';

import useDomFilters, {FilterFields} from './useNetworkFilters';

jest.mock('react-router');
jest.mock('sentry/utils/useLocation');

const mockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>;
const mockBrowserHistoryPush = browserHistory.push as jest.MockedFunction<
  typeof browserHistory.push
>;

const networkSpans: NetworkSpan[] = [
  {
    op: 'navigation.navigate',
    description: 'http://localhost:3000/',
    startTimestamp: 1663131080.5554,
    endTimestamp: 1663131080.6947,
    data: {
      size: 1334,
    },
  },
  {
    op: 'resource.link',
    description: 'http://localhost:3000/static/css/main.1856e8e3.chunk.css',
    startTimestamp: 1663131080.5767,
    endTimestamp: 1663131080.5951,
    data: {
      size: 300,
    },
  },
  {
    op: 'resource.script',
    description: 'http://localhost:3000/static/js/2.3b866bed.chunk.js',
    startTimestamp: 1663131080.5770998,
    endTimestamp: 1663131080.5979,
    data: {
      size: 300,
    },
  },
  {
    op: 'resource.fetch',
    description: 'https://pokeapi.co/api/v2/pokemon',
    startTimestamp: 1663131080.641,
    endTimestamp: 1663131080.65,
    data: {
      method: 'GET',
      statusCode: 200,
    },
  },
  {
    op: 'resource.img',
    description: 'http://localhost:3000/static/media/logo.ddd5084d.png',
    startTimestamp: 1663131080.6422,
    endTimestamp: 1663131080.6441,
    data: {
      size: 300,
    },
  },
  {
    op: 'resource.css',
    description:
      'http://localhost:3000/static/media/glyphicons-halflings-regular.448c34a5.woff2',
    startTimestamp: 1663131080.6447997,
    endTimestamp: 1663131080.6548998,
    data: {
      size: 300,
    },
  },
  {
    op: 'navigation.push',
    description: '/mypokemon',
    startTimestamp: 1663131082.346,
    endTimestamp: 1663131082.346,
    data: {},
  },
  {
    op: 'resource.fetch',
    description: 'https://pokeapi.co/api/v2/pokemon/pikachu',
    startTimestamp: 1663131092.471,
    endTimestamp: 1663131092.48,
    data: {
      method: 'GET',
      statusCode: 200,
    },
  },
  {
    op: 'resource.fetch',
    description: 'https://pokeapi.co/api/v2/pokemon/mewtu',
    startTimestamp: 1663131120.198,
    endTimestamp: 1663131122.693,
    data: {
      method: 'GET',
      statusCode: 404,
    },
  },
];

describe('useDomFilters', () => {
  beforeEach(() => {
    mockBrowserHistoryPush.mockReset();
  });

  it('should update the url when setters are called', () => {
    const TYPE_FILTER = ['fetch'];
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

    const {result, rerender} = reactHooks.renderHook(() => useDomFilters({networkSpans}));

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

    const {result} = reactHooks.renderHook(() => useDomFilters({networkSpans}));
    expect(result.current.items.length).toEqual(9);
  });

  it('should filter by status', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_n_status: ['200'],
      },
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(() => useDomFilters({networkSpans}));
    expect(result.current.items.length).toEqual(2);
  });

  it('should filter by type', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_n_type: ['fetch'],
      },
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(() => useDomFilters({networkSpans}));
    expect(result.current.items.length).toEqual(3);
  });

  it('should filter by searchTerm', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_n_search: 'pikachu',
      },
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(() => useDomFilters({networkSpans}));
    expect(result.current.items.length).toEqual(1);
  });

  it('should filter by type, searchTerm and logLevel', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_n_status: ['200'],
        f_n_type: ['fetch'],
        f_n_search: 'pokemon/',
      },
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(() => useDomFilters({networkSpans}));
    expect(result.current.items.length).toEqual(1);
  });
});
