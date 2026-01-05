import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {CodeBlock} from 'sentry/components/core/code';
import * as Storybook from 'sentry/stories';
import type {MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import type {
  TabularColumn,
  TabularData,
  TabularRow,
} from 'sentry/views/dashboards/widgets/common/types';
import {sampleHTTPRequestTableData} from 'sentry/views/dashboards/widgets/tableWidget/fixtures/sampleHTTPRequestTableData';
import {TableWidgetVisualization} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';
import {Actions} from 'sentry/views/discover/table/cellAction';

export default Storybook.story('TableWidgetVisualization', story => {
  const customColumns: TabularColumn[] = [
    {
      key: 'count(span.duration)',
      type: 'number',
    },
    {
      key: 'http.request_method',
      type: 'string',
    },
  ];

  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="TableWidgetVisualization" /> is meant to be a robust
          and eventual replacement to all tables in Dashboards and Insights (and
          potentially more). The inner component of this table is{' '}
          <Storybook.JSXNode name="GridEditable" />. The table includes features like
          sorting, column resizing and cell actions. The table allows for custom
          renderers, but is also able to correctly render fields on its own using
          fallbacks.
        </p>
        <p>
          Below is the the most basic example of the table which requires
          <code>tableData</code> to populate the headers and body of the table
        </p>
        <TableWidgetVisualization tableData={sampleHTTPRequestTableData} />
      </Fragment>
    );
  });

  story('Table Data and Optional Columns', () => {
    const tableWithEmptyData: TabularData = {
      ...sampleHTTPRequestTableData,
      data: [],
    };
    const aliases = {
      'count(span.duration)': 'Count of Span Duration',
      'http.request_method': 'HTTP Request Method',
    };
    return (
      <Fragment>
        <p>
          The table data uses the type
          <code>TabularData</code>. This is a mandatory prop. If the <code>data</code>{' '}
          field is empty, such as
        </p>
        <CodeBlock language="json">
          {`
${JSON.stringify(tableWithEmptyData)}
          `}
        </CodeBlock>
        <p>Then the table renders empty like this:</p>
        <TableWidgetVisualization tableData={tableWithEmptyData} />
        <p>
          The table columns use the type <code>TabularColumn[]</code> which is based off
          of <code>GridColumnOrder</code> from <Storybook.JSXNode name="GridEditable" />.
          The prop is optional, as the table will fallback to extract the columns in order
          from the table data's <code>meta.fields</code>, displaying them as shown above.
        </p>
        <p>For example, this prop can be used for reordering columns:</p>
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          columns={customColumns}
        />
        <CodeBlock language="json">
          {`
${JSON.stringify(customColumns)}
          `}
        </CodeBlock>
        <p>
          To pass custom names for a column header, provide the prop <code>aliases</code>{' '}
          which maps column key to the alias. In some cases you may have both field
          aliases set by user (e.g., in dashboards) as well as a static mapping. The util
          function <code>decodeColumnAliases</code> is provided to consolidate them, with
          priority given to user field aliases.
        </p>
        <p>
          Below is an example of setting aliases to make column headers more human
          readable.
        </p>
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          aliases={aliases}
        />
        <CodeBlock language="json">
          {`
${JSON.stringify(aliases)}
          `}
        </CodeBlock>
      </Fragment>
    );
  });

  story('Sorting', () => {
    const location = useLocation();
    const [data, setData] = useState<TabularData>(sampleHTTPRequestTableData);
    const [sort, setSort] = useState<Sort>();
    function onChangeSort(newSort: Sort) {
      const sortedData: Array<TabularRow<string>> = Object.entries(
        sampleHTTPRequestTableData.data
      )
        .sort(([, a], [, b]) => {
          const aField = a?.[newSort.field] ?? 0;
          const bField = b?.[newSort.field] ?? 0;
          const value = newSort.kind === 'asc' ? 1 : -1;

          if (aField < bField) return -value;
          if (aField > bField) return value;
          return 0;
        })
        .map(result => result[1]);
      setSort(newSort);
      setData({data: sortedData, meta: data.meta});
    }

    const sortableColumns = customColumns.map(column => ({
      ...column,
      sortable: true,
      width: -1,
    }));
    return (
      <Fragment>
        <p>
          By default, column fields are assumed to be not sortable. To enable sorting,
          pass the
          <code>columns</code> prop with the field <code>sortable</code> set to true.
          e.g.,
        </p>
        <CodeBlock language="tsx">
          {`
columns={[{
  key: 'count(span.duration)',
  name: 'count(span.duration)',
  type: 'number',
  sortable: true
},
{
  key: 'http.request_method',
  name: 'http.request_method',
  type: 'string',
}]}
          `}
        </CodeBlock>
        <p>
          This table <b>does not</b> sort entries. Almost all tables in Sentry rely on the{' '}
          <code>sort</code> URL query parameter as a reference for sorting, which is why
          most of the default behavior in this section is to fallback to the URL
          parameter.{' '}
          <i>
            The table displays the rows in the order the data is provided and you are
            responsible for ensuring the data is sorted.
          </i>
        </p>
        <p>
          Sorting may require the display of a directional arrow. The table will try to
          automatically determine the direction based on the <code>sort</code> URL query
          parameter. Note that the table only supports sorting by one column at a time, so
          if multiple <code>sort</code> parameters are provided, it will choose the first
          one.
        </p>
        <p>
          For an interactive example, click column headers below and pay attention to the
          parameter in the URL. Use the button to reset the parameter.
        </p>
        <ButtonContainer>
          <LinkButton to={{...location, query: {...location.query, sort: undefined}}}>
            Clear sort parameter
          </LinkButton>
        </ButtonContainer>
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          columns={sortableColumns}
        />
        <p>
          If the sort is not stored in the parameter, then pass the <code>sort</code> prop
          to correctly display the sort arrow direction. Similarly to the default
          behavior, only one sort is allowed. If both the prop and parameter are defined,
          the table will prioritize the prop. You can test this by clicking column headers
          and note how the arrow doesn't change in the table below.
        </p>
        <br />
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          sort={{field: 'http.request_method', kind: 'desc'}}
          columns={sortableColumns}
        />

        <p>
          The default action when a sortable column header is clicked is to update the
          <code>sort</code> URL query parameter. If you wish to override the URL update,
          you can pass <code>onChangeSort</code> which accepts a<code>Sort</code>
          object that represents the newly selected sort. This and the <code>sort</code>
          prop are useful if you need to manage internal state or perform custom sorting.
        </p>
        <p>
          Try clicking the column headers below!{' '}
          <b>
            Current sort is
            <code>{sort?.field ?? 'undefined'}</code> by
            <code>{sort?.kind ?? 'undefined'}</code> order
          </b>
        </p>
        <TableWidgetVisualization
          columns={sortableColumns}
          tableData={data}
          sort={sort}
          onChangeSort={(newSort: Sort) => onChangeSort(newSort)}
        />
        <CodeBlock language="tsx">
          {`
const [data, setData] = useState<TabularData>(...);
const [sort, setSort] = useState<Sort>();

// Performs sorting and updates internal state
function onChangeSort(newSort: Sort) {
  const sortedData: Array<TabularRow<string>> = Object.entries(
    sampleHTTPRequestTableData.data
  )
    .sort(([, a], [, b]) => {
      const aField = a?.[newSort.field] ?? 0;
      const bField = b?.[newSort.field] ?? 0;
      const value = newSort.kind === 'asc' ? 1 : -1;

      if (aField < bField) return -value;
      if (aField > bField) return value;
      return 0;
    })
    .map(result => result[1]);
  setSort(newSort);
  setData({data: sortedData, meta: data.meta});
}
        `}
        </CodeBlock>
      </Fragment>
    );
  });

  story('Column Widths and Resizing', () => {
    const location = useLocation();
    const noWidthColumns = customColumns.map(column => ({...column, width: undefined}));
    const customWidthsColumns = customColumns.map(column => ({...column, width: 200}));
    const [columns, setColumns] = useState<TabularColumn[]>(noWidthColumns);

    return (
      <Fragment>
        <p>
          To set column widths, add the <code>width</code>field to a column in{' '}
          <code>columns</code>prop. Column widths are specified in pixels. If a column
          width is not specified, the special value <code>-1</code>is assumed and{' '}
          <Storybook.JSXNode name="TableWidgetVisualization" /> will automatically expand
          the column. The special value can also be explicitly set.
        </p>
        <p>
          By default, table columns are assumed to be resizable. Pass
          <code>{'resizable={false}'}</code> to disable it. Resizing is only available if
          there are at least two columns in the table.
        </p>
        <p>
          If a table is not column resizable, but needs custom widths, set the{' '}
          <code>width</code> field. For example:
        </p>
        <TableWidgetVisualization
          columns={customWidthsColumns}
          tableData={sampleHTTPRequestTableData}
          resizable={false}
        />
        <p>
          Also by default, is <Storybook.JSXNode name="TableWidgetVisualization" />{' '}
          managing column widths and resizing via <code>width</code> URL parameters. E.g.,{' '}
          <code>?width=-1&width=512</code> will set the first column to have automatic
          width, and the second column to have a width of 512px. Note: this behavior only
          applies if the table columns are resizable.
        </p>
        <p>
          If both the URL parameters and <code>width</code>field in the{' '}
          <code>columns</code>prop are supplied, the table will prioritize the prop. If
          you want the default behavior and need to pass <code>columns</code>, then ensure
          that the <code>width</code>field does not exist or is set to{' '}
          <code>undefined</code>for every column.
        </p>
        <p>
          Try interacting with the columns and making note of the URL parameter. Use the
          button to clear the width parameters.
        </p>
        <ButtonContainer>
          <LinkButton to={{...location, query: {...location.query, width: undefined}}}>
            Clear width parameters
          </LinkButton>
        </ButtonContainer>
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          columns={noWidthColumns}
        />
        <p>
          If you wish to override default behavior of updating the URL, pass the callback
          function <code>onResizeColumn</code>, which accepts <code>TabularColumn[]</code>{' '}
          representing the columns with new widths. This and the <code>width</code>field
          in <code>columns</code>is useful if you need to manage internal state:
        </p>
        <p>
          Current widths are{' '}
          <b>[{columns.map(column => column.width ?? 'undefined').toString()}]</b>
        </p>
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          columns={columns}
          onResizeColumn={newColumns => setColumns(newColumns)}
        />
      </Fragment>
    );
  });

  story('Cell Actions', () => {
    const [filter, setFilter] = useState<Array<string | number>>([]);
    return (
      <Fragment>
        <p>
          The default enabled cell actions are copying text to the clipboard and opening
          external links in a new tab. To customize the list of allowed cell actions for
          the entire table, use the <code>allowedCellActions</code> prop. For example,
          passing <code>[]</code> will disable actions completely:
        </p>
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          allowedCellActions={[]}
        />
        <p>
          If a custom list of cell actions is supplied, then pass the{' '}
          <code>onTriggerCellAction</code> prop to add behavior when the action is
          selected by the user. This table only provides default behavior for copying text
          and opening external links. You are responsible to supply behavior for any
          custom actions.
        </p>
        <p>
          Current filter: <b>[{filter.toString()}]</b>
        </p>
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          allowedCellActions={[Actions.ADD, Actions.EXCLUDE]}
          onTriggerCellAction={(actions: Actions, value: string | number) => {
            switch (actions) {
              case Actions.ADD:
                if (!filter.includes(value)) setFilter([...filter, value]);
                break;
              case Actions.EXCLUDE:
                setFilter(filter.filter(_value => _value !== value));
                break;
              default:
                break;
            }
          }}
        />
        <CodeBlock language="tsx">
          {`
const [filter, setFilter] = useState<Array<string | number>>([]);

function onTriggerCellAction(actions: Actions, value: string | number) {
  switch (actions) {
    case Actions.ADD:
      if (!filter.includes(value)) setFilter([...filter, value]);
      break;
    case Actions.EXCLUDE:
      setFilter(filter.filter(_value => _value !== value));
      break;
    default:
      break;
  }
}
        `}
        </CodeBlock>
      </Fragment>
    );
  });

  story('Using Custom Cell Rendering', () => {
    function getRenderer(fieldName: string) {
      if (fieldName === 'http.request_method') {
        return function (dataRow: TabularRow) {
          return <Tag variant="muted">{dataRow[fieldName]}</Tag>;
        };
      }

      return getFieldRenderer(
        fieldName,
        sampleHTTPRequestTableData.meta as MetaType,
        false
      );
    }
    return (
      <Fragment>
        <p>
          By default, the table uses the default field renderers. These renderers are
          aware of special fields like projects and assignees, as well as common typed
          numeric fields like durations and sizes. In most cases, you should use the
          default renderers. If you are adding a new common field that should render the
          same in all tables, please add it to the default renderers.
        </p>
        <p>
          If you need custom rendering, you can pass a <code>getRenderer</code> prop.{' '}
          <code>getRenderer</code> is a function that accepts the name of a field, the
          current data row, and the current table meta. It should return a renderer
          function. A renderer function takes the current data row and a "baggage" object,
          and returns a React node. If you need custom baggage, you can pass the{' '}
          <code>makeBaggage</code> prop.{' '}
          <em>
            If you provide a custom renderer, you are fully responsible for rendering all
            columns!{' '}
          </em>{' '}
          we suggest adding a fallback via the <code>getFieldRenderer</code> function.
        </p>
        <p>
          In the below example, a custom renderer is used to wrap HTTP methods in a{' '}
          <code>Tag</code> element.
        </p>
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          getRenderer={getRenderer}
        />
        <CodeBlock language="tsx">
          {`
function getRenderer(fieldName: string) {
  if (fieldName === 'http.request_method') {
    return function (dataRow: TabularRow) {
      return <Tag>{dataRow[fieldName]}</Tag>;
    };
  }

  return getFieldRenderer(
    fieldName,
    sampleHTTPRequestTableData.meta as MetaType,
    false
  );
}
          `}
        </CodeBlock>
      </Fragment>
    );
  });

  story('Loading Placeholder', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="TableWidgetVisualization.LoadingPlaceholder" /> can be
          used as a loading placeholder
        </p>
        <TableWidgetVisualization.LoadingPlaceholder />
        <p>
          Optionally, you can pass the
          <code>columns</code>
          prop to render them in the loading placeholder. You can also pass
          <code>aliases</code> to apply custom names to columns. Note: sorting and
          resizing are disabled in the loading placeholder.
        </p>
        <TableWidgetVisualization.LoadingPlaceholder
          columns={customColumns.map(column => ({...column, width: -1}))}
        />
      </Fragment>
    );
  });
});

const ButtonContainer = styled('div')`
  display: flex;
  justify-content: center;
  margin: 20px;
`;
