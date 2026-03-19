import {useState} from 'react';

import {act, render} from 'sentry-test/reactTestingLibrary';

import {isUUID} from 'sentry/utils/string/isUUID';

import {useDragNDropColumns, type Column} from './useDragNDropColumns';

describe('useDragNDropColumns', () => {
  const initialColumns = ['span.op', 'span_id', 'timestamp'];

  it('should insert a column', () => {
    let columns!: string[];
    let setColumns: (columns: string[]) => void;
    let insertColumn: (column: string) => void;

    function TestPage() {
      [columns, setColumns] = useState(initialColumns);
      ({insertColumn} = useDragNDropColumns({columns, setColumns}));
      return null;
    }

    render(<TestPage />);

    act(() => insertColumn(''));
    expect(columns).toEqual(['span.op', 'span_id', 'timestamp', '']);

    act(() => insertColumn('span.description'));
    expect(columns).toEqual(['span.op', 'span_id', 'timestamp', '', 'span.description']);
  });

  it('should update a column at a specific index', () => {
    let columns!: string[];
    let setColumns: (columns: string[]) => void;
    let updateColumnAtIndex: (i: number, column: string) => void;

    function TestPage() {
      [columns, setColumns] = useState(initialColumns);
      ({updateColumnAtIndex} = useDragNDropColumns({columns, setColumns}));
      return null;
    }

    render(<TestPage />);

    act(() => updateColumnAtIndex(0, 'span.description'));

    expect(columns).toEqual(['span.description', 'span_id', 'timestamp']);
  });

  it('should delete a column at a specific index', () => {
    let columns!: string[];
    let setColumns: (columns: string[]) => void;
    let deleteColumnAtIndex: (index: number) => void;

    function TestPage() {
      [columns, setColumns] = useState(initialColumns);
      ({deleteColumnAtIndex} = useDragNDropColumns({columns, setColumns}));
      return null;
    }

    render(<TestPage />);

    act(() => deleteColumnAtIndex(0));

    expect(columns).toEqual(['span_id', 'timestamp']);
  });

  it('should swap two columns at specific indices', () => {
    let columns!: string[];
    let setColumns: (columns: string[]) => void;
    let onDragEnd: (arg: any) => void;

    function TestPage() {
      [columns, setColumns] = useState(initialColumns);
      ({onDragEnd} = useDragNDropColumns({columns, setColumns}));
      return null;
    }

    render(<TestPage />);

    act(() =>
      onDragEnd({
        active: {id: 1},
        over: {id: 3},
      })
    );

    expect(columns).toEqual(['span_id', 'timestamp', 'span.op']);
  });

  it('should generate unique UUIDs for editable columns', () => {
    let columns!: string[];
    let setColumns: (columns: string[]) => void;
    let editableColumns!: Array<Column<string>>;

    function TestPage() {
      [columns, setColumns] = useState(initialColumns);
      ({editableColumns} = useDragNDropColumns({columns, setColumns}));
      return null;
    }

    render(<TestPage />);

    expect(editableColumns).toHaveLength(initialColumns.length);
    expect(editableColumns.map(column => column.column)).toEqual(initialColumns);
    expect(editableColumns.every(column => isUUID(column.uniqueId))).toBe(true);
    expect(new Set(editableColumns.map(column => column.uniqueId)).size).toBe(
      editableColumns.length
    );
  });

  it('should generate unique UUIDs when column values are duplicated', () => {
    const duplicateColumns = ['span.op', 'span.op', 'span.op'];
    let columns!: string[];
    let setColumns: (columns: string[]) => void;
    let editableColumns!: Array<Column<string>>;

    function TestPage() {
      [columns, setColumns] = useState(duplicateColumns);
      ({editableColumns} = useDragNDropColumns({columns, setColumns}));
      return null;
    }

    render(<TestPage />);

    expect(editableColumns.map(column => column.column)).toEqual(duplicateColumns);
    expect(new Set(editableColumns.map(column => column.uniqueId)).size).toBe(
      duplicateColumns.length
    );
  });

  it('should preserve unique IDs when updating a column value', () => {
    let columns!: string[];
    let setColumns: (columns: string[]) => void;
    let editableColumns!: Array<Column<string>>;
    let updateColumnAtIndex: (i: number, column: string) => void;

    function TestPage() {
      [columns, setColumns] = useState(initialColumns);
      ({editableColumns, updateColumnAtIndex} = useDragNDropColumns({
        columns,
        setColumns,
      }));
      return null;
    }

    render(<TestPage />);

    const uniqueIdsBefore = editableColumns.map(column => column.uniqueId);

    act(() => updateColumnAtIndex(1, 'span.description'));

    const uniqueIdsAfter = editableColumns.map(column => column.uniqueId);
    expect(uniqueIdsAfter).toEqual(uniqueIdsBefore);
  });
});
// trivial change for CI testing
