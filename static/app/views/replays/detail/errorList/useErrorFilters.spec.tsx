import {browserHistory} from 'react-router';
import type {Location} from 'history';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import type {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import type {Color} from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';

import useNetworkFilters, {ErrorSelectOption, FilterFields} from './useErrorFilters';

jest.mock('react-router');
jest.mock('sentry/utils/useLocation');

const mockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>;
const mockBrowserHistoryPush = browserHistory.push as jest.MockedFunction<
  typeof browserHistory.push
>;

type DefaultCrumb = Extract<Crumb, BreadcrumbTypeDefault>;

const ERROR_1_JS_RANGEERROR = {
  type: BreadcrumbType.ERROR as const,
  level: BreadcrumbLevelType.ERROR,
  category: 'issue',
  message: 'Invalid time value',
  data: {
    label: 'RangeError',
    eventId: '415ecb5c85ac43b19f1886bb41ddab96',
    groupId: 11,
    groupShortId: 'JAVASCRIPT-RANGE',
    project: 'javascript',
  },
  timestamp: '2023-06-09T12:00:00+00:00',
  id: 360,
  color: 'red300' as Color,
  description: 'Error',
};

const ERROR_2_NEXTJS_TYPEERROR = {
  type: BreadcrumbType.ERROR as const,
  level: BreadcrumbLevelType.ERROR,
  category: 'issue',
  message: `undefined is not an object (evaluating 'e.apply').`,
  data: {
    label: 'TypeError',
    eventId: 'ac43b19f1886bb41ddab96415ecb5c85',
    groupId: 22,
    groupShortId: 'NEXTJS-TYPE',
    project: 'next-js',
  },
  timestamp: '2023-06-09T12:10:00+00:00',
  id: 360,
  color: 'red300' as Color,
  description: 'Error',
};

const ERROR_3_JS_UNDEFINED = {
  type: BreadcrumbType.ERROR as const,
  level: BreadcrumbLevelType.ERROR,
  category: 'issue',
  message: 'Maximum update depth exceeded.',
  data: {
    label: 'Error',
    eventId: '9f1886bb41ddab96415ecb5c85ac43b1',
    groupId: 22,
    groupShortId: 'JAVASCRIPT-UNDEF',
    project: 'javascript',
  },
  timestamp: '2023-06-09T12:20:00+00:00',
  id: 360,
  color: 'red300' as Color,
  description: 'Error',
};

describe('useErrorFilters', () => {
  const errorCrumbs: DefaultCrumb[] = [
    ERROR_1_JS_RANGEERROR,
    ERROR_2_NEXTJS_TYPEERROR,
    ERROR_3_JS_UNDEFINED,
  ];

  beforeEach(() => {
    mockBrowserHistoryPush.mockReset();
  });

  it('should update the url when setters are called', () => {
    const PROJECT_OPTION = {
      value: 'resource.fetch',
      label: 'resource.fetch',
      qs: 'f_e_project',
    } as ErrorSelectOption;
    const SEARCH_FILTER = 'BadRequestError';

    mockUseLocation
      .mockReturnValueOnce({
        pathname: '/',
        query: {},
      } as Location<FilterFields>)
      .mockReturnValueOnce({
        pathname: '/',
        query: {f_e_project: [PROJECT_OPTION.value]},
      } as Location<FilterFields>);

    const {result, rerender} = reactHooks.renderHook(useNetworkFilters, {
      initialProps: {errorCrumbs},
    });

    result.current.setFilters([PROJECT_OPTION]);
    expect(browserHistory.push).toHaveBeenLastCalledWith({
      pathname: '/',
      query: {
        f_e_project: [PROJECT_OPTION.value],
      },
    });

    rerender();

    result.current.setSearchTerm(SEARCH_FILTER);
    expect(browserHistory.push).toHaveBeenLastCalledWith({
      pathname: '/',
      query: {
        f_e_project: [PROJECT_OPTION.value],
        f_e_search: SEARCH_FILTER,
      },
    });
  });

  it('should not filter anything when no values are set', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {},
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(useNetworkFilters, {
      initialProps: {errorCrumbs},
    });
    expect(result.current.items).toHaveLength(3);
  });

  it('should filter by project', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_e_project: ['javascript'],
      },
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(useNetworkFilters, {
      initialProps: {errorCrumbs},
    });
    expect(result.current.items).toStrictEqual([
      ERROR_1_JS_RANGEERROR,
      ERROR_3_JS_UNDEFINED,
    ]);
  });

  it('should filter by searchTerm', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_e_search: 'Maximum update depth',
      },
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(useNetworkFilters, {
      initialProps: {errorCrumbs},
    });
    expect(result.current.items).toHaveLength(1);
  });
});

describe('getProjectOptions', () => {
  it('should default to having nothing in the list of method types', () => {
    const errorCrumbs = [];

    const {result} = reactHooks.renderHook(useNetworkFilters, {
      initialProps: {errorCrumbs},
    });

    expect(result.current.getProjectOptions()).toStrictEqual([]);
  });

  it('should return a sorted list of project slugs', () => {
    const errorCrumbs = [ERROR_2_NEXTJS_TYPEERROR, ERROR_3_JS_UNDEFINED];

    const {result} = reactHooks.renderHook(useNetworkFilters, {
      initialProps: {errorCrumbs},
    });

    expect(result.current.getProjectOptions()).toStrictEqual([
      {label: 'javascript', value: 'javascript', qs: 'f_e_project'},
      {label: 'next-js', value: 'next-js', qs: 'f_e_project'},
    ]);
  });

  it('should deduplicate BreadcrumbType', () => {
    const errorCrumbs = [ERROR_1_JS_RANGEERROR, ERROR_3_JS_UNDEFINED];

    const {result} = reactHooks.renderHook(useNetworkFilters, {
      initialProps: {errorCrumbs},
    });

    expect(result.current.getProjectOptions()).toStrictEqual([
      {label: 'javascript', value: 'javascript', qs: 'f_e_project'},
    ]);
  });
});
