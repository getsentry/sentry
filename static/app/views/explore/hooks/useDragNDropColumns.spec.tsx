import {useState} from 'react';

import {act, render} from 'sentry-test/reactTestingLibrary';

import {useDragNDropColumns} from './useDragNDropColumns';

describe('useDragNDropColumns', () => {
  const initialColumns = ['span.op', 'span_id', 'timestamp'];

  function defaultColumn(): string {
    return '';
  }

  it('should insert a column', () => {
    let columns!: string[];
    let setColumns: (columns: string[]) => void;
    let insertColumn: (column?: string) => void;

    function TestPage() {
      [columns, setColumns] = useState(initialColumns);
      ({insertColumn} = useDragNDropColumns({columns, defaultColumn, setColumns}));
      return null;
    }

    render(<TestPage />);

    act(() => {
      insertColumn();
    });
    expect(columns).toEqual(['span.op', 'span_id', 'timestamp', '']);

    act(() => {
      insertColumn('span.description');
    });
    expect(columns).toEqual(['span.op', 'span_id', 'timestamp', '', 'span.description']);
  });

  it('should update a column at a specific index', () => {
    let columns!: string[];
    let setColumns: (columns: string[]) => void;
    let updateColumnAtIndex: (i: number, column: string) => void;

    function TestPage() {
      [columns, setColumns] = useState(initialColumns);
      ({updateColumnAtIndex} = useDragNDropColumns({columns, defaultColumn, setColumns}));
      return null;
    }

    render(<TestPage />);

    act(() => {
      updateColumnAtIndex(0, 'span.description');
    });

    expect(columns).toEqual(['span.description', 'span_id', 'timestamp']);
  });

  it('should delete a column at a specific index', () => {
    let columns!: string[];
    let setColumns: (columns: string[]) => void;
    let deleteColumnAtIndex: (index: number) => void;

    function TestPage() {
      [columns, setColumns] = useState(initialColumns);
      ({deleteColumnAtIndex} = useDragNDropColumns({columns, defaultColumn, setColumns}));
      return null;
    }

    render(<TestPage />);

    act(() => {
      deleteColumnAtIndex(0);
    });

    expect(columns).toEqual(['span_id', 'timestamp']);
  });

  it('should swap two columns at specific indices', () => {
    let columns!: string[];
    let setColumns: (columns: string[]) => void;
    let onDragEnd: (arg: any) => void;

    function TestPage() {
      [columns, setColumns] = useState(initialColumns);
      ({onDragEnd} = useDragNDropColumns({columns, defaultColumn, setColumns}));
      return null;
    }

    render(<TestPage />);

    act(() => {
      onDragEnd({
        active: {id: 1},
        over: {id: 3},
      });
    });

    expect(columns).toEqual(['span_id', 'timestamp', 'span.op']);
  });
});
