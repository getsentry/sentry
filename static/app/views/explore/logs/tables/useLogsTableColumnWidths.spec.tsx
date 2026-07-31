import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useLogsTableColumnWidths} from 'sentry/views/explore/logs/tables/useLogsTableColumnWidths';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

const MESSAGE = OurLogKnownFieldKey.MESSAGE;
const FLEX = 'minmax(90px, 1fr)';

function styleWith(value: string) {
  const style = document.createElement('table').style;
  style.gridTemplateColumns = value;
  return style;
}

function mockGridTemplateColumns(value: string) {
  jest.spyOn(window, 'getComputedStyle').mockReturnValue(styleWith(value));
  return {current: document.createElement('table')};
}

describe('useLogsTableColumnWidths', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the flex message default when not scrolling', () => {
    const tableRef = mockGridTemplateColumns('60px 175px 500px');
    const fields = ['timestamp', 'code.file.path', MESSAGE];

    const {result} = renderHook(() =>
      useLogsTableColumnWidths({
        fields,
        tableRef,
        isPending: false,
        isScrolling: false,
        dataLength: 10,
      })
    );

    expect(result.current).toEqual({[MESSAGE]: FLEX});
  });

  it('defaults the last column to flexible before scrolling when there is no message field', () => {
    const tableRef = mockGridTemplateColumns('60px 175px 500px');
    const fields = ['timestamp', 'code.file.path'];

    const {result} = renderHook(() =>
      useLogsTableColumnWidths({
        fields,
        tableRef,
        isPending: false,
        isScrolling: false,
        dataLength: 10,
      })
    );

    expect(result.current).toEqual({'code.file.path': FLEX});
  });

  it('locks non-message columns to pixels and keeps message flexible when scrolling', () => {
    // prefix track is 60px, so field i maps to track i + 1
    const tableRef = mockGridTemplateColumns('60px 175px 500px 800px');
    const fields = ['timestamp', 'code.file.path', MESSAGE];

    const {result} = renderHook(() =>
      useLogsTableColumnWidths({
        fields,
        tableRef,
        isPending: false,
        isScrolling: true,
        dataLength: 10,
      })
    );

    expect(result.current).toEqual({
      timestamp: 175,
      'code.file.path': 500,
      [MESSAGE]: FLEX,
    });
  });

  it('makes the last column flexible when there is no message field', () => {
    const tableRef = mockGridTemplateColumns('60px 175px 500px');
    const fields = ['timestamp', 'code.file.path'];

    const {result} = renderHook(() =>
      useLogsTableColumnWidths({
        fields,
        tableRef,
        isPending: false,
        isScrolling: true,
        dataLength: 10,
      })
    );

    expect(result.current).toEqual({
      timestamp: 175,
      'code.file.path': FLEX,
    });
  });

  it('does not lock while data is pending', () => {
    const tableRef = mockGridTemplateColumns('60px 175px 500px 800px');
    const fields = ['timestamp', 'code.file.path', MESSAGE];

    const {result} = renderHook(() =>
      useLogsTableColumnWidths({
        fields,
        tableRef,
        isPending: true,
        isScrolling: true,
        dataLength: 10,
      })
    );

    expect(result.current).toEqual({[MESSAGE]: FLEX});
  });

  it('does not lock when a measured track is not a finite pixel value', () => {
    // getComputedStyle can return non-numeric tracks before layout settles.
    const tableRef = mockGridTemplateColumns('60px auto 500px 800px');
    const fields = ['timestamp', 'code.file.path', MESSAGE];

    const {result} = renderHook(() =>
      useLogsTableColumnWidths({
        fields,
        tableRef,
        isPending: false,
        isScrolling: true,
        dataLength: 10,
      })
    );

    expect(result.current).toEqual({[MESSAGE]: FLEX});
  });

  it('does not lock when there are fewer measured tracks than fields', () => {
    // Missing the leading prefix track means the field-to-track mapping is off.
    const tableRef = mockGridTemplateColumns('175px 500px 800px');
    const fields = ['timestamp', 'code.file.path', MESSAGE];

    const {result} = renderHook(() =>
      useLogsTableColumnWidths({
        fields,
        tableRef,
        isPending: false,
        isScrolling: true,
        dataLength: 10,
      })
    );

    expect(result.current).toEqual({[MESSAGE]: FLEX});
  });

  it('keeps the lock when the fields array identity changes but its contents do not', () => {
    const tableRef = mockGridTemplateColumns('60px 175px 500px 800px');

    const {result, rerender} = renderHook(
      ({fields}) =>
        useLogsTableColumnWidths({
          fields,
          tableRef,
          isPending: false,
          isScrolling: true,
          dataLength: 10,
        }),
      {initialProps: {fields: ['timestamp', 'code.file.path', MESSAGE]}}
    );

    expect(result.current).toEqual({
      timestamp: 175,
      'code.file.path': 500,
      [MESSAGE]: FLEX,
    });

    // A new array with identical contents (e.g. from a sort/date change) must
    // not drop the lock, even though the measurement would now differ.
    jest.spyOn(window, 'getComputedStyle').mockReturnValue(styleWith('60px 1px 1px 1px'));
    rerender({fields: ['timestamp', 'code.file.path', MESSAGE]});

    expect(result.current).toEqual({
      timestamp: 175,
      'code.file.path': 500,
      [MESSAGE]: FLEX,
    });
  });

  it('re-locks with fresh measurements after fields change', () => {
    const tableRef = mockGridTemplateColumns('60px 175px 500px 800px');

    const {result, rerender} = renderHook(
      ({fields}) =>
        useLogsTableColumnWidths({
          fields,
          tableRef,
          isPending: false,
          isScrolling: true,
          dataLength: 10,
        }),
      {initialProps: {fields: ['timestamp', 'code.file.path', MESSAGE]}}
    );

    expect(result.current).toEqual({
      timestamp: 175,
      'code.file.path': 500,
      [MESSAGE]: FLEX,
    });

    jest
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue(styleWith('60px 200px 600px 900px'));
    rerender({fields: ['timestamp', 'server.address', MESSAGE]});

    expect(result.current).toEqual({
      timestamp: 200,
      'server.address': 600,
      [MESSAGE]: FLEX,
    });
  });
});
