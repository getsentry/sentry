import {act} from 'react-test-renderer';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import type {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import type {Color} from 'sentry/utils/theme';

import useSortErrors from './useSortErrors';

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

describe('useSortErrors', () => {
  const items: DefaultCrumb[] = [
    ERROR_1_JS_RANGEERROR,
    ERROR_3_JS_UNDEFINED,
    ERROR_2_NEXTJS_TYPEERROR,
  ];

  it('should the list by timestamp by default', () => {
    const {result} = reactHooks.renderHook(useSortErrors, {
      initialProps: {items},
    });

    expect(result.current.sortConfig).toStrictEqual({
      by: 'timestamp',
      asc: true,
      getValue: expect.any(Function),
    });
    expect(result.current.items).toStrictEqual([
      ERROR_1_JS_RANGEERROR,
      ERROR_2_NEXTJS_TYPEERROR,
      ERROR_3_JS_UNDEFINED,
    ]);
  });

  it('should reverse the sort order', () => {
    const {result, rerender} = reactHooks.renderHook(useSortErrors, {
      initialProps: {items},
    });

    act(() => {
      result.current.handleSort('timestamp');
    });

    rerender({items});

    expect(result.current.sortConfig).toStrictEqual({
      by: 'timestamp',
      asc: false,
      getValue: expect.any(Function),
    });
    expect(result.current.items).toStrictEqual([
      ERROR_3_JS_UNDEFINED,
      ERROR_2_NEXTJS_TYPEERROR,
      ERROR_1_JS_RANGEERROR,
    ]);
  });

  it('should sort by the title field', () => {
    const {result, rerender} = reactHooks.renderHook(useSortErrors, {
      initialProps: {items},
    });

    act(() => {
      result.current.handleSort('title');
    });

    rerender({items});

    expect(result.current.sortConfig).toStrictEqual({
      by: 'title',
      asc: true,
      getValue: expect.any(Function),
    });
    expect(result.current.items).toStrictEqual([
      ERROR_1_JS_RANGEERROR,
      ERROR_3_JS_UNDEFINED,
      ERROR_2_NEXTJS_TYPEERROR,
    ]);
  });

  it('should sort by project', () => {
    const mixedItems = [
      ERROR_3_JS_UNDEFINED,
      ERROR_2_NEXTJS_TYPEERROR,
      ERROR_1_JS_RANGEERROR,
    ];
    const {result, rerender} = reactHooks.renderHook(useSortErrors, {
      initialProps: {items: mixedItems},
    });

    act(() => {
      result.current.handleSort('project');
    });

    rerender({items: mixedItems});

    expect(result.current.sortConfig).toStrictEqual({
      by: 'project',
      asc: true,
      getValue: expect.any(Function),
    });
    expect(result.current.items).toStrictEqual([
      ERROR_3_JS_UNDEFINED,
      ERROR_1_JS_RANGEERROR,
      ERROR_2_NEXTJS_TYPEERROR,
    ]);

    act(() => {
      result.current.handleSort('project');
    });

    rerender({items: mixedItems});

    expect(result.current.sortConfig).toStrictEqual({
      by: 'project',
      asc: false,
      getValue: expect.any(Function),
    });
    expect(result.current.items).toStrictEqual([
      ERROR_2_NEXTJS_TYPEERROR,
      ERROR_3_JS_UNDEFINED,
      ERROR_1_JS_RANGEERROR,
    ]);
  });
});
