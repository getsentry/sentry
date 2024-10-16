import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useDragNDropColumns} from './useDragNDropColumns';

describe('useDragNDropColumns', () => {
  const initialColumns = ['span.op', 'span_id', 'timestamp'];

  it('should initialize editableColumns correctly', () => {
    const {result} = renderHook(() => useDragNDropColumns({columns: initialColumns}));

    expect(result.current.editableColumns).toEqual([
      {id: 1, column: 'span.op'},
      {id: 2, column: 'span_id'},
      {id: 3, column: 'timestamp'},
    ]);
  });

  it('should insert a column', () => {
    const {result} = renderHook(() => useDragNDropColumns({columns: initialColumns}));

    act(() => {
      result.current.insertColumn();
    });

    expect(result.current.editableColumns).toEqual([
      {id: 1, column: 'span.op'},
      {id: 2, column: 'span_id'},
      {id: 3, column: 'timestamp'},
      {id: 4, column: undefined},
    ]);
  });

  it('should update a column at a specific index', () => {
    const {result} = renderHook(() => useDragNDropColumns({columns: initialColumns}));

    act(() => {
      result.current.updateColumnAtIndex(1, 'updatedColumn');
    });

    expect(result.current.editableColumns[1].column).toBe('updatedColumn');
  });

  it('should delete a column at a specific index', () => {
    const {result} = renderHook(() => useDragNDropColumns({columns: initialColumns}));

    act(() => {
      result.current.deleteColumnAtIndex(1);
    });

    expect(result.current.editableColumns).toEqual([
      {id: 1, column: 'span.op'},
      {id: 3, column: 'timestamp'},
    ]);
  });

  it('should swap two columns at specific indices', () => {
    const {result} = renderHook(() => useDragNDropColumns({columns: initialColumns}));

    act(() => {
      result.current.swapColumnsAtIndex(0, 2);
    });

    expect(result.current.editableColumns).toEqual([
      {id: 2, column: 'span_id'},
      {id: 3, column: 'timestamp'},
      {id: 1, column: 'span.op'},
    ]);
  });
});
