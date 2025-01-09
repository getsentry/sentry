import {useState} from 'react';

import {act, render} from 'sentry-test/reactTestingLibrary';

import {useDragNDropColumns} from './useDragNDropColumns';

describe('useDragNDropColumns', () => {
  const initialColumns = ['span.op', 'span_id', 'timestamp'];

  it('should insert a column', () => {
    let columns!: string[];
    let setColumns: (columns: string[]) => void;
    let insertColumn: ReturnType<typeof useDragNDropColumns>['insertColumn'];

    function TestPage() {
      [columns, setColumns] = useState(initialColumns);
      ({insertColumn} = useDragNDropColumns({columns, setColumns}));
      return null;
    }

    render(<TestPage />, {disableRouterMocks: true});

    act(() => {
      insertColumn();
    });

    expect(columns).toEqual(['span.op', 'span_id', 'timestamp', '']);
  });

  it('should update a column at a specific index', () => {
    let columns!: string[];
    let setColumns: (columns: string[]) => void;
    let updateColumnAtIndex: ReturnType<
      typeof useDragNDropColumns
    >['updateColumnAtIndex'];

    function TestPage() {
      [columns, setColumns] = useState(initialColumns);
      ({updateColumnAtIndex} = useDragNDropColumns({columns, setColumns}));
      return null;
    }

    render(<TestPage />, {disableRouterMocks: true});

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
      ({deleteColumnAtIndex} = useDragNDropColumns({columns, setColumns}));
      return null;
    }

    render(<TestPage />, {disableRouterMocks: true});

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
      ({onDragEnd} = useDragNDropColumns({columns, setColumns}));
      return null;
    }

    render(<TestPage />, {disableRouterMocks: true});

    act(() => {
      onDragEnd({
        active: {id: 1},
        over: {id: 3},
      });
    });

    expect(columns).toEqual(['span_id', 'timestamp', 'span.op']);
  });
});
