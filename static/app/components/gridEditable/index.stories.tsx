import {Fragment, useCallback, useState} from 'react';
import {Location} from 'history';

import {Button} from 'sentry/components/button';
import GridEditable, {GridColumnOrder} from 'sentry/components/gridEditable';
import useQueryBasedColumnResize from 'sentry/components/replays/useQueryBasedColumnResize';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import Matrix from 'sentry/components/stories/matrix';
import SideBySide from 'sentry/components/stories/sideBySide';
import {backend, frontend} from 'sentry/data/platformCategories';
import storyBook from 'sentry/stories/storyBook';
import {useLocation} from 'sentry/utils/useLocation';

interface ExampleDataItem {
  category: 'frontend' | 'backend';
  name: string;
}

export default storyBook(GridEditable, story => {
  const columns: GridColumnOrder<keyof ExampleDataItem>[] = [
    {key: 'category', name: 'Platform Category'},
    {key: 'name', name: 'Platform Name'},
  ];

  const data: ExampleDataItem[] = [
    ...frontend.slice(0, 3).map(name => ({name, category: 'frontend' as const})),
    ...backend.slice(0, 3).map(name => ({name, category: 'backend' as const})),
  ];

  const mockLocation: Location = {
    key: '',
    search: '',
    hash: '',
    action: 'PUSH',
    state: null,
    query: {},
    pathname: '/mock-pathname/',
  };

  story('Minimal', () => {
    return (
      <GridEditable
        data={[]}
        columnOrder={columns}
        columnSortBy={[]}
        grid={{}}
        location={mockLocation}
      />
    );
  });

  const columnsWithWidth: GridColumnOrder<keyof ExampleDataItem | 'other'>[] =
    columns.map(col => {
      col.width = 200;
      return col;
    });
  columnsWithWidth.push({key: 'other', name: 'Other', width: 200});

  const renderHeadCell = (column: GridColumnOrder, columnIndex: number) =>
    `#${columnIndex} ${column.name}`;

  const renderBodyCell = (
    column: GridColumnOrder<keyof ExampleDataItem | 'other'>,
    dataRow: ExampleDataItem,
    rowIndex: number,
    columnIndex: number
  ) =>
    column.key in dataRow
      ? dataRow[column.key]
      : JSON.stringify({column, dataRow, rowIndex, columnIndex});

  story('Basic', () => {
    return (
      <Fragment>
        <p>
          By default the column widths are resizable, but will reset frequently unless you
          persist them somehow.
        </p>
        <GridEditable
          data={data}
          columnOrder={columnsWithWidth}
          columnSortBy={[]}
          grid={{
            renderHeadCell,
            renderBodyCell,
          }}
          location={mockLocation}
        />
      </Fragment>
    );
  });

  story('Props', () => (
    <SideBySide>
      <div>
        <p>
          <JSXNode name="GridEditable" props={{error: String}} />
        </p>
        <GridEditable
          error="An error happened"
          data={data}
          columnOrder={columns}
          columnSortBy={[]}
          grid={{}}
          location={mockLocation}
        />
      </div>
      <div>
        <p>
          <JSXNode name="GridEditable" props={{isLoading: true}} />
        </p>
        <GridEditable
          isLoading
          data={data}
          columnOrder={columns}
          columnSortBy={[]}
          grid={{}}
          location={mockLocation}
        />
      </div>
    </SideBySide>
  ));

  function useStatefulColumnWidths() {
    const [columnsWithDynamicWidths, setColumns] =
      useState<GridColumnOrder<keyof ExampleDataItem | 'other'>[]>(columnsWithWidth);

    const handleResizeColumn = useCallback(
      (
        columnIndex: number,
        nextColumn: GridColumnOrder<keyof ExampleDataItem | 'other'>
      ) => {
        setColumns(prev => {
          const next = [...prev];
          next[columnIndex] = nextColumn;
          return next;
        });
      },
      []
    );

    return {
      columns: columnsWithDynamicWidths,
      handleResizeColumn,
    };
  }

  story('Column Resize', () => {
    const statefulColumnResize = useStatefulColumnWidths();

    const location = useLocation();
    const queryBasedColumnResize = useQueryBasedColumnResize({
      columns: columnsWithWidth,
      paramName: 'width',
      location,
    });

    return (
      <Fragment>
        <p>
          You can keep track of the column widths by implementing the{' '}
          <JSXProperty name="onResizeColumn" value={Function} /> callback.
        </p>
        <SideBySide>
          <div>
            <p>In this example we are saving the column widths to state.</p>
            <GridEditable
              data={data}
              columnOrder={statefulColumnResize.columns}
              columnSortBy={[]}
              grid={{
                renderHeadCell,
                renderBodyCell,
                onResizeColumn: statefulColumnResize.handleResizeColumn,
              }}
              location={mockLocation}
            />
          </div>
          <div>
            <p>
              In this example we are using <kbd>useQueryBasedColumnResize</kbd>. Notice
              how the url updates after you drag columns.
            </p>
            <GridEditable
              data={data}
              columnOrder={queryBasedColumnResize.columns}
              columnSortBy={[]}
              grid={{
                renderHeadCell,
                renderBodyCell,
                onResizeColumn: queryBasedColumnResize.handleResizeColumn,
              }}
              location={mockLocation}
            />
          </div>
        </SideBySide>
      </Fragment>
    );
  });

  story('Fixed Height', () => (
    <GridEditable
      data={data}
      columnOrder={columns}
      columnSortBy={[]}
      grid={{
        renderHeadCell,
        renderBodyCell,
      }}
      location={mockLocation}
      height={200}
      stickyHeader
    />
  ));

  story('Header Augmentations', () => (
    <Matrix
      render={GridEditable}
      propMatrix={{
        data: [data],
        columnOrder: [columns],
        columnSortBy: [[]],
        grid: [{}],
        location: [mockLocation],
        headerButtons: [undefined, () => <Button>Take Action</Button>],
        title: [undefined, 'GridEditable Title'],
      }}
      selectedProps={['title', 'headerButtons']}
      sizingWindowProps={{display: 'block'}}
    />
  ));
});
