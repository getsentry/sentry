import {RawReplayErrorFixture} from 'sentry-fixture/replay/error';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import hydrateErrors from 'sentry/utils/replays/hydrateErrors';
import useSortErrors from 'sentry/views/replays/detail/errorList/useSortErrors';

jest.mock('sentry/utils/useUrlParams', () => {
  const map = new Map();
  return (name: any, dflt: any) => {
    if (!map.has(name)) {
      map.set(name, dflt);
    }
    return {
      getParamValue: () => map.get(name),
      setParamValue: (value: any) => {
        map.set(name, value);
      },
    };
  };
});

const {
  errorFrames: [ERROR_1_JS_RANGEERROR, ERROR_2_NEXTJS_TYPEERROR, ERROR_3_JS_UNDEFINED],
  feedbackFrames: [],
} = hydrateErrors(
  ReplayRecordFixture({started_at: new Date('2023-06-09T12:00:00+00:00')}),
  [
    RawReplayErrorFixture({
      'error.type': ['RangeError'],
      timestamp: new Date('2023-06-09T12:00:00+00:00'),
      id: '415ecb5c85ac43b19f1886bb41ddab96',
      'issue.id': 11,
      issue: 'JAVASCRIPT-RANGE',
      title: 'Invalid time value',
      'project.name': 'javascript',
    }),
    RawReplayErrorFixture({
      'error.type': ['TypeError'],
      timestamp: new Date('2023-06-09T12:10:00+00:00'),
      id: 'ac43b19f1886bb41ddab96415ecb5c85',
      'issue.id': 22,
      issue: 'NEXTJS-TYPE',
      title: `undefined is not an object (evaluating 'e.apply').`,
      'project.name': 'next-js',
    }),
    RawReplayErrorFixture({
      'error.type': ['TypeError'],
      timestamp: new Date('2023-06-09T12:20:00+00:00'),
      id: '9f1886bb41ddab96415ecb5c85ac43b1',
      'issue.id': 22,
      issue: 'JAVASCRIPT-UNDEF',
      title: `Maximum update depth exceeded`,
      'project.name': 'javascript',
    }),
  ]
);

describe('useSortErrors', () => {
  const items = [
    ERROR_1_JS_RANGEERROR!,
    ERROR_3_JS_UNDEFINED!,
    ERROR_2_NEXTJS_TYPEERROR!,
  ];

  it('should the list by timestamp by default', () => {
    const {result} = renderHook(useSortErrors, {
      initialProps: {items},
    });

    expect(result.current.sortConfig).toStrictEqual({
      by: 'timestamp',
      asc: true,
      getValue: expect.any(Function),
    });
    expect(result.current.items).toStrictEqual([
      ERROR_1_JS_RANGEERROR!,
      ERROR_2_NEXTJS_TYPEERROR!,
      ERROR_3_JS_UNDEFINED!,
    ]);
  });

  it('should reverse the sort order', () => {
    const {result, rerender} = renderHook(useSortErrors, {
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
      ERROR_3_JS_UNDEFINED!,
      ERROR_2_NEXTJS_TYPEERROR!,
      ERROR_1_JS_RANGEERROR!,
    ]);
  });

  it('should sort by the title field', () => {
    const {result, rerender} = renderHook(useSortErrors, {
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
      ERROR_1_JS_RANGEERROR!,
      ERROR_3_JS_UNDEFINED!,
      ERROR_2_NEXTJS_TYPEERROR!,
    ]);
  });

  it('should sort by project', () => {
    const mixedItems = [
      ERROR_3_JS_UNDEFINED!,
      ERROR_2_NEXTJS_TYPEERROR!,
      ERROR_1_JS_RANGEERROR!,
    ];
    const {result, rerender} = renderHook(useSortErrors, {
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
      ERROR_3_JS_UNDEFINED!,
      ERROR_1_JS_RANGEERROR!,
      ERROR_2_NEXTJS_TYPEERROR!,
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
