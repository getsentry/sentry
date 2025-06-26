import {Fragment, useCallback, useState} from 'react';

import {Button} from 'sentry/components/core/button';
import type {GridColumnOrder} from 'sentry/components/tables/gridEditable';
import GridEditable from 'sentry/components/tables/gridEditable';
import useQueryBasedColumnResize from 'sentry/components/tables/gridEditable/useQueryBasedColumnResize';
import {backend, frontend} from 'sentry/data/platformCategories';
import * as Storybook from 'sentry/stories';
import {useLocation} from 'sentry/utils/useLocation';

interface ExampleDataItem {
  category: 'frontend' | 'backend';
  name: string;
}

export default Storybook.story('GridEditable', story => {
  const columns: Array<GridColumnOrder<keyof ExampleDataItem>> = [
    {key: 'category', name: 'Platform Category'},
    {key: 'name', name: 'Platform Name'},
  ];

  const data: ExampleDataItem[] = [
    ...frontend.slice(0, 3).map(name => ({name, category: 'frontend' as const})),
    ...backend.slice(0, 3).map(name => ({name, category: 'backend' as const})),
  ];

  story('Minimal', () => {
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
        />
      </Fragment>
    );
  });

  story('Props', () => (
    <Storybook.SideBySide>
      <div>
        <p>
          <Storybook.JSXNode name="GridEditable" props={{error: String}} />
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
          <Storybook.JSXNode name="GridEditable" props={{isLoading: true}} />
        </p>
        <GridEditable
          isLoading
          data={data}
          columnOrder={columns}
          columnSortBy={[]}
          grid={{}}
        />
      </div>
    </Storybook.SideBySide>
  ));

  story('Row Mouse Events', () => {
    const [activeRowKey, setActiveRowKey] = useState<number | undefined>(undefined);
    const activeRow = activeRowKey === undefined ? undefined : data[activeRowKey];

    return (
      <Fragment>
        <p>
          You can provide a{' '}
          <Storybook.JSXProperty name="onRowMouseOver" value={Function} /> and a{' '}
          <Storybook.JSXProperty name="onRowMouseOut" value={Function} /> callback. You
          can also combine that with the{' '}
          <Storybook.JSXProperty name="highlightedRowKey" value={Number} /> prop to
          highlight a row.
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
          <Storybook.JSXProperty name="onResizeColumn" value={Function} /> callback.
        </p>
        <Storybook.SideBySide>
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
        </Storybook.SideBySide>
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
      height={200}
      stickyHeader
    />
  ));

  story('Header Augmentations', () => (
    <Storybook.PropMatrix
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
      // Storybook.SizingWindowProps={{display: 'block'}}
    />
  ));

  story('Sticky Headers and Scrolling', () => {
    return (
      <Fragment>
        <p>
          Passing
          <Storybook.JSXProperty name="stickyHeader" value={Boolean} /> and{' '}
          <Storybook.JSXProperty name="scrollable" value={Boolean} />
          add sticky headers and table scrolling respectively
        </p>
        <Storybook.SideBySide>
          <div>
            <div>No sticky headers</div>
            <GridEditable
              data={data}
              columnOrder={columns}
              columnSortBy={[]}
              grid={{
                renderHeadCell,
                renderBodyCell,
              }}
              scrollable
              height={200}
            />
          </div>
          <div>
            <div>With sticky headers</div>
            <GridEditable
              data={data}
              columnOrder={columns}
              columnSortBy={[]}
              grid={{
                renderHeadCell,
                renderBodyCell,
              }}
              stickyHeader
              scrollable
              height={200}
            />
          </div>
        </Storybook.SideBySide>
      </Fragment>
    );
  });

  story('Enforcing Cell to fit Content', () => {
    const newData = [
      ...data,
      {
        name: 'Something very long',
        category:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent fringilla ultricies turpis, quis lobortis leo varius ut. Maecenas venenatis purus a sodales facilisis.',
      },
    ] as ExampleDataItem[];
    return (
      <Fragment>
        <p>
          Passing
          <Storybook.JSXProperty name="fit" value={'max-content'} /> will set the width of
          the grid to fit around the content.
        </p>
        <p>
          <Storybook.JSXNode name="GridEditable" /> will by default resize the columns to
          fit within it's container. So columns of long width may take up multiple lines
          or be cut off, which might not be desired (ex. when the table has many columns
          or is placed into a small container). One way to control column width this is to
          provide
          <Storybook.JSXProperty name="minColumnWidth" value={'number'} />, which applies
          the same width to all columns. However, this does not account for varying widths
          between columns, unlike this prop does.
        </p>
        <Storybook.SideBySide>
          <div style={{width: 400}}>
            <div>Without fit content is forced in multiple lines or cut off</div>
            <GridEditable
              data={newData}
              columnOrder={columns}
              columnSortBy={[]}
              grid={{
                renderHeadCell,
                renderBodyCell,
              }}
            />
          </div>
          <div style={{width: 400}}>
            <div>With fit the content forces the table to expand (scroll)</div>
            <GridEditable
              data={newData}
              columnOrder={columns}
              columnSortBy={[]}
              grid={{
                renderHeadCell,
                renderBodyCell,
              }}
              fit="max-content"
            />
          </div>
        </Storybook.SideBySide>
      </Fragment>
    );
  });
});
