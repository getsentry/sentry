import type {Location} from 'history';
import {
  ReplayNavigationFrameFixture,
  ReplayNavigationPushFrameFixture,
  ReplayRequestFrameFixture,
  ReplayResourceFrameFixture,
} from 'sentry-fixture/replay/replaySpanFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import hydrateSpans from 'sentry/utils/replays/hydrateSpans';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

import type {FilterFields, NetworkSelectOption} from './useNetworkFilters';
import useNetworkFilters from './useNetworkFilters';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useNavigate');

const mockUseNavigate = jest.mocked(useNavigate);
const mockUseLocation = jest.mocked(useLocation);

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

describe('useNetworkFilters', () => {
  const networkFrames = [
    SPAN_0_NAVIGATE!,
    SPAN_1_LINK!,
    SPAN_2_SCRIPT!,
    SPAN_3_FETCH!,
    SPAN_4_IMG!,
    SPAN_5_CSS!,
    SPAN_6_PUSH!,
    SPAN_7_FETCH_GET!,
    SPAN_8_FETCH_POST!,
  ];

  it('should update the url when setters are called', () => {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);
    const TYPE_OPTION: NetworkSelectOption = {
      value: 'resource.fetch',
      label: 'resource.fetch',
      qs: 'f_n_type' as const,
    };
    const STATUS_OPTION: NetworkSelectOption = {
      value: '200',
      label: '200',
      qs: 'f_n_status' as const,
    };
    const SEARCH_FILTER = 'pikachu';

    mockUseLocation
      .mockReturnValueOnce({
        pathname: '/',
        query: {},
      } as Location<FilterFields>)
      .mockReturnValueOnce({
        pathname: '/',
        query: {f_n_type: [TYPE_OPTION.value]},
      } as Location<FilterFields>)
      .mockReturnValueOnce({
        pathname: '/',
        query: {f_n_type: [TYPE_OPTION.value], f_n_status: [STATUS_OPTION.value]},
      } as Location<FilterFields>);

    const {result, rerender} = renderHook(useNetworkFilters, {
      initialProps: {networkFrames},
    });

    result.current.setFilters([TYPE_OPTION]);
    expect(mockNavigate).toHaveBeenLastCalledWith(
      {
        pathname: '/',
        query: {
          f_n_method: [],
          f_n_status: [],
          f_n_type: [TYPE_OPTION.value],
        },
      },
      {replace: true}
    );

    rerender({networkFrames});

    result.current.setFilters([TYPE_OPTION, STATUS_OPTION]);
    expect(mockNavigate).toHaveBeenLastCalledWith(
      {
        pathname: '/',
        query: {
          f_n_method: [],
          f_n_status: [STATUS_OPTION.value],
          f_n_type: [TYPE_OPTION.value],
        },
      },
      {replace: true}
    );

    rerender({networkFrames});

    result.current.setSearchTerm(SEARCH_FILTER);
    expect(mockNavigate).toHaveBeenLastCalledWith(
      {
        pathname: '/',
        query: {
          f_n_type: [TYPE_OPTION.value],
          f_n_status: [STATUS_OPTION.value],
          f_n_search: SEARCH_FILTER,
        },
      },
      {replace: true}
    );
  });

  it('should clear details params when setters are called', () => {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    const TYPE_OPTION: NetworkSelectOption = {
      value: 'resource.fetch',
      label: 'resource.fetch',
      qs: 'f_n_type',
    };
    const STATUS_OPTION: NetworkSelectOption = {
      value: '200',
      label: '200',
      qs: 'f_n_status',
    };
    const SEARCH_FILTER = 'pikachu';

    mockUseLocation
      .mockReturnValueOnce({
        pathname: '/',
        query: {
          n_detail_row: '0',
          n_detail_tab: 'response',
        },
      } as Location<FilterFields>)
      .mockReturnValueOnce({
        pathname: '/',
        query: {
          f_n_type: [TYPE_OPTION.value],
          n_detail_row: '0',
          n_detail_tab: 'response',
        },
      } as Location<FilterFields>)
      .mockReturnValueOnce({
        pathname: '/',
        query: {
          f_n_type: [TYPE_OPTION.value],
          f_n_status: [STATUS_OPTION.value],
          n_detail_row: '0',
          n_detail_tab: 'response',
        },
      } as Location<FilterFields>);

    const {result, rerender} = renderHook(useNetworkFilters, {
      initialProps: {networkFrames},
    });

    result.current.setFilters([TYPE_OPTION]);
    expect(mockNavigate).toHaveBeenLastCalledWith(
      {
        pathname: '/',
        query: {
          f_n_method: [],
          f_n_status: [],
          f_n_type: [TYPE_OPTION.value],
        },
      },
      {replace: true}
    );

    rerender({networkFrames});

    result.current.setFilters([TYPE_OPTION, STATUS_OPTION]);
    expect(mockNavigate).toHaveBeenLastCalledWith(
      {
        pathname: '/',
        query: {
          f_n_method: [],
          f_n_status: [STATUS_OPTION.value],
          f_n_type: [TYPE_OPTION.value],
        },
      },
      {replace: true}
    );

    rerender({networkFrames});

    result.current.setSearchTerm(SEARCH_FILTER);
    expect(mockNavigate).toHaveBeenLastCalledWith(
      {
        pathname: '/',
        query: {
          f_n_status: [STATUS_OPTION.value],
          f_n_type: [TYPE_OPTION.value],
          f_n_search: SEARCH_FILTER,
        },
      },
      {replace: true}
    );
  });

  it('should not filter anything when no values are set', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {},
    } as Location<FilterFields>);

    const {result} = renderHook(useNetworkFilters, {
      initialProps: {networkFrames},
    });
    expect(result.current.items).toHaveLength(9);
  });

  it('should filter by method', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_n_method: ['POST'],
      },
    } as Location<FilterFields>);

    const {result} = renderHook(useNetworkFilters, {
      initialProps: {networkFrames},
    });
    expect(result.current.items).toStrictEqual([SPAN_8_FETCH_POST]);
  });

  it('should include css/js/img when method GET is selected', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_n_method: ['GET'],
      },
    } as Location<FilterFields>);

    const {result} = renderHook(useNetworkFilters, {
      initialProps: {networkFrames},
    });
    expect(result.current.items).toHaveLength(8);
  });

  it('should filter by status', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_n_status: ['200'],
      },
    } as Location<FilterFields>);

    const {result} = renderHook(useNetworkFilters, {
      initialProps: {networkFrames},
    });
    expect(result.current.items).toHaveLength(2);
  });

  it('should filter by type', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_n_type: ['resource.fetch'],
      },
    } as Location<FilterFields>);

    const {result} = renderHook(useNetworkFilters, {
      initialProps: {networkFrames},
    });
    expect(result.current.items).toHaveLength(3);
  });

  it('should filter by searchTerm', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_n_search: 'pikachu',
      },
    } as Location<FilterFields>);

    const {result} = renderHook(useNetworkFilters, {
      initialProps: {networkFrames},
    });
    expect(result.current.items).toHaveLength(1);
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

    const {result} = renderHook(useNetworkFilters, {
      initialProps: {networkFrames},
    });
    expect(result.current.items).toHaveLength(1);
  });
});

describe('getMethodTypes', () => {
  it('should default to having GET in the list of method types', () => {
    const networkFrames = [];

    const {result} = renderHook(useNetworkFilters, {
      initialProps: {networkFrames},
    });

    expect(result.current.getMethodTypes()).toStrictEqual([
      {label: 'GET', value: 'GET', qs: 'f_n_method'},
    ]);
  });

  it('should return a sorted list of method types', () => {
    const networkFrames = [SPAN_8_FETCH_POST!, SPAN_7_FETCH_GET!];

    const {result} = renderHook(useNetworkFilters, {
      initialProps: {networkFrames},
    });

    expect(result.current.getMethodTypes()).toStrictEqual([
      {label: 'GET', value: 'GET', qs: 'f_n_method'},
      {label: 'POST', value: 'POST', qs: 'f_n_method'},
    ]);
  });

  it('should deduplicate BreadcrumbType', () => {
    const networkFrames = [SPAN_2_SCRIPT!, SPAN_3_FETCH!, SPAN_7_FETCH_GET!];

    const {result} = renderHook(useNetworkFilters, {
      initialProps: {networkFrames},
    });

    expect(result.current.getMethodTypes()).toStrictEqual([
      {label: 'GET', value: 'GET', qs: 'f_n_method'},
    ]);
  });
});

describe('getResourceTypes', () => {
  it('should default to having fetch in the list of span types', () => {
    const networkFrames = [];

    const {result} = renderHook(useNetworkFilters, {
      initialProps: {networkFrames},
    });

    expect(result.current.getResourceTypes()).toStrictEqual([
      {label: 'fetch', value: 'resource.fetch', qs: 'f_n_type'},
    ]);
  });

  it('should return a sorted list of BreadcrumbType', () => {
    const networkFrames = [SPAN_0_NAVIGATE!, SPAN_1_LINK!, SPAN_2_SCRIPT!];

    const {result} = renderHook(useNetworkFilters, {
      initialProps: {networkFrames},
    });

    expect(result.current.getResourceTypes()).toStrictEqual([
      {label: 'fetch', value: 'resource.fetch', qs: 'f_n_type'},
      {label: 'link', value: 'resource.link', qs: 'f_n_type'},
      {label: 'navigate', value: 'navigation.navigate', qs: 'f_n_type'},
      {label: 'script', value: 'resource.script', qs: 'f_n_type'},
    ]);
  });

  it('should deduplicate BreadcrumbType', () => {
    const networkFrames = [
      SPAN_0_NAVIGATE!,
      SPAN_1_LINK!,
      SPAN_2_SCRIPT!,
      SPAN_3_FETCH!,
      SPAN_7_FETCH_GET!,
    ];

    const {result} = renderHook(useNetworkFilters, {
      initialProps: {networkFrames},
    });

    expect(result.current.getResourceTypes()).toStrictEqual([
      {label: 'fetch', value: 'resource.fetch', qs: 'f_n_type'},
      {label: 'link', value: 'resource.link', qs: 'f_n_type'},
      {label: 'navigate', value: 'navigation.navigate', qs: 'f_n_type'},
      {label: 'script', value: 'resource.script', qs: 'f_n_type'},
    ]);
  });
});

describe('getStatusTypes', () => {
  it('should return a sorted list of BreadcrumbType', () => {
    const networkFrames = [
      SPAN_0_NAVIGATE!,
      SPAN_1_LINK!,
      SPAN_2_SCRIPT!,
      SPAN_8_FETCH_POST!,
    ];

    const {result} = renderHook(useNetworkFilters, {
      initialProps: {networkFrames},
    });

    expect(result.current.getStatusTypes()).toStrictEqual([
      {
        label: '200',
        value: '200',
        qs: 'f_n_status',
      },
      {label: '404', value: '404', qs: 'f_n_status'},
      {label: 'unknown', value: 'unknown', qs: 'f_n_status'},
    ]);
  });

  it('should deduplicate BreadcrumbType', () => {
    const networkFrames = [
      SPAN_0_NAVIGATE!,
      SPAN_1_LINK!,
      SPAN_2_SCRIPT!,
      SPAN_3_FETCH!,
      SPAN_7_FETCH_GET!,
      SPAN_8_FETCH_POST!,
    ];

    const {result} = renderHook(useNetworkFilters, {
      initialProps: {networkFrames},
    });

    expect(result.current.getStatusTypes()).toStrictEqual([
      {
        label: '200',
        value: '200',
        qs: 'f_n_status',
      },
      {label: '404', value: '404', qs: 'f_n_status'},
      {label: 'unknown', value: 'unknown', qs: 'f_n_status'},
    ]);
  });
});
