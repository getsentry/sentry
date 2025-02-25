import {Fragment, useCallback, useState} from 'react';

import {Button} from 'sentry/components/button';
import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable from 'sentry/components/gridEditable';
import useQueryBasedColumnResize from 'sentry/components/replays/useQueryBasedColumnResize';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import Matrix from 'sentry/components/stories/matrix';
import {backend, frontend} from 'sentry/data/platformCategories';
import StoryBook from 'sentry/stories/storyBook';
import {useLocation} from 'sentry/utils/useLocation';

interface ExampleDataItem {
  category: 'frontend' | 'backend';
  name: string;
}

export default StoryBook('GridEditable', Story => {
  const columns: Array<GridColumnOrder<keyof ExampleDataItem>> = [
    {key: 'category', name: 'Platform Category'},
    {key: 'name', name: 'Platform Name'},
  ];

  const data: ExampleDataItem[] = [
    ...frontend.slice(0, 3).map(name => ({name, category: 'frontend' as const})),
    ...backend.slice(0, 3).map(name => ({name, category: 'backend' as const})),
  ];

  Story('Minimal', () => {
    return <GridEditable data={[]} columnOrder={columns} columnSortBy={[]} grid={{}} />;
  });

  const columnsWithWidth: Array<GridColumnOrder<keyof ExampleDataItem | 'other'>> =
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
      ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        dataRow[column.key]
      : JSON.stringify({column, dataRow, rowIndex, columnIndex});

  Story('Basic', () => {
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
        />
      </Fragment>
    );
  });

  Story('Props', () => (
    <Story.SideBySide>
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
        />
      </div>
    </Story.SideBySide>
  ));

  Story('Row Mouse Events', () => {
    const [activeRowKey, setActiveRowKey] = useState<number | undefined>(undefined);
    const activeRow = activeRowKey !== undefined ? data[activeRowKey] : undefined;

    return (
      <Fragment>
        <p>
          You can provide a <JSXProperty name="onRowMouseOver" value={Function} /> and a{' '}
          <JSXProperty name="onRowMouseOut" value={Function} /> callback. You can also
          combine that with the <JSXProperty name="highlightedRowKey" value={Number} />{' '}
          prop to highlight a row.
        </p>
        <p>
          Hovered Row: {activeRow?.category} {activeRow?.name}
        </p>
        <GridEditable
          data={data}
          columnOrder={columns}
          columnSortBy={[]}
          grid={{}}
          onRowMouseOver={(_dataRow, key) => {
            setActiveRowKey(key);
          }}
          onRowMouseOut={() => {
            setActiveRowKey(undefined);
          }}
          highlightedRowKey={activeRowKey}
        />
      </Fragment>
    );
  });

  function useStatefulColumnWidths() {
    const [columnsWithDynamicWidths, setColumns] =
      useState<Array<GridColumnOrder<keyof ExampleDataItem | 'other'>>>(columnsWithWidth);

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

  Story('Column Resize', () => {
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
        <Story.SideBySide>
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
            />
          </div>
        </Story.SideBySide>
      </Fragment>
    );
  });

  Story('Fixed Height', () => (
    <GridEditable
      data={data}
      columnOrder={columns}
      columnSortBy={[]}
      grid={{
        renderHeadCell,
        renderBodyCell,
      }}
      height={200}
      stickyHeader
    />
  ));

  Story('Header Augmentations', () => (
    <Matrix
      render={GridEditable}
      propMatrix={{
        data: [data],
        columnOrder: [columns],
        columnSortBy: [[]],
        grid: [{}],
        headerButtons: [undefined, () => <Button>Take Action</Button>],
        title: [undefined, 'GridEditable Title'],
      }}
      selectedProps={['title', 'headerButtons']}
      sizingWindowProps={{display: 'block'}}
    />
  ));
});
