import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {Tag} from 'sentry/components/core/badge/tag';
import {LinkButton} from 'sentry/components/core/button/linkButton';
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

export default Storybook.story('TableWidgetVisualization', story => {
  const customColumns: TabularColumn[] = [
    {
      key: 'count(span.duration)',
      name: 'count(span.duration)',
      type: 'number',
      width: 200,
    },
    {
      key: 'http.request_method',
      name: 'http.request_method',
      type: 'string',
      width: -1,
    },
  ];

  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="TableWidgetVisualization" /> is meant to be a robust
          and eventual replacement to all tables in Dashboards and Insights (and
          potentially more). The inner component of this table is{' '}
          <Storybook.JSXNode name="GridEditable" />. The table allows for custom
          renderers, but is also able to correctly render fields on its own using
          fallbacks. Future features planned include sorting, resizing and customizable
          cell actions.
        </p>
        <p>
          Below is the the most basic example of the table which requires
          <code>tableData</code> to populate the headers and body of the table
        </p>
        <TableWidgetVisualization tableData={sampleHTTPRequestTableData} />
      </Fragment>
    );
  });

  story('Table Data and Optional Table Columns', () => {
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
        <CodeSnippet language="json">
          {`
${JSON.stringify(tableWithEmptyData)}
          `}
        </CodeSnippet>
        <p>Then the table renders empty like this:</p>
        <TableWidgetVisualization tableData={tableWithEmptyData} />
        <p>
          The table columns use the type <code>TabularColumn[]</code> which is based off
          of <code>GridColumnOrder</code> from <Storybook.JSXNode name="GridEditable" />.
          The prop is optional, as the table will fallback to extract the columns in order
          from the table data's <code>meta.fields</code>, displaying them as shown above.
        </p>
        <p>This prop is used for reordering columns and setting column widths:</p>
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          columns={customColumns}
        />
        <CodeSnippet language="json">
          {`
${JSON.stringify(customColumns)}
          `}
        </CodeSnippet>
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
        <CodeSnippet language="json">
          {`
${JSON.stringify(aliases)}
          `}
        </CodeSnippet>
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
        <CodeSnippet language="tsx">
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
        </CodeSnippet>
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
        <CodeSnippet language="tsx">
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
        </CodeSnippet>
      </Fragment>
    );
  });

  story('Column resizing', () => {
    const location = useLocation();
    const noWidthColumns = customColumns.map(column => ({...column, width: undefined}));
    const [columns, setColumns] = useState<TabularColumn[]>(noWidthColumns);

    function onChangeResizeColumn(widths: number[]) {
      const newColumns = columns.map((column, index) => ({
        ...column,
        width: widths[index],
      }));
      setColumns(newColumns);
    }

    return (
      <Fragment>
        <p>
          By default, table column widths are assumed to be resizable, mainly because most
          use cases allow for this. If no resizing is required, pass the
          <code>{'resizable={false}'}</code> to disable it. As a side note, resizing
          requires at least two columns to take effect. Having only one column means{' '}
          <code>resizable</code>prop does nothing. Widths are represented with numbers
          which are further interpreted as pixels.
        </p>
        <p>
          There are two methods this table uses to set widths. The first is to provide the
          <code>width</code>
          field when passing <code>columns</code> prop. One use case of this prop is to
          set the width of non-resizable table columns.
        </p>
        <p>Below is an example of a non column resizable table with preset widths.</p>
        <TableWidgetVisualization
          columns={customColumns}
          tableData={sampleHTTPRequestTableData}
          resizable={false}
        />
        <p>
          The second method is to automatically parse it from the <code>width</code> URL
          query parameters if it exists. Note that this requires the table columns to be
          resizable. This is behaviour occurs in the following situations:
        </p>
        <ol>
          <li>
            <code>columns</code>prop is not passed
          </li>
          <li>
            <code>columns</code>prop is passed AND no column in <code>columns</code> has
            defined the field<code>width</code>
          </li>
        </ol>
        <p>
          To elaborate on point two, if you want to use the default url parameters and
          need to pass <code>columns</code>prop, then do not add the <code>width</code>
          field to all columns or set the field to be <code>undefined</code>
          for all columns.
        </p>
        <p>
          Try interacting with the columns and making note of the url parameter. Use the
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
        If the table encounters an undefined width (e.g., neither the prop or url
        parameters are provided), then the column defaults to a width of
        <code>-1</code>. The table will fallback on the default behaviour
        <Storybook.JSXNode name="GridEditable" /> uses for undefined widths.
        <p>
          Similar to sorting, the default behavior when a column is resized is to update
          the <code>width</code>url query parameters. If you wish to override this
          behaviour pass the callback function <code>onChangeResizeColumn</code>, which
          accepts a number array representing the new widths of each column. This and the{' '}
          <code>width</code>field in <code>columns</code>is useful if you need to manage
          internal state:
        </p>
        <p>
          Current widths are{' '}
          <b>[{columns.map(column => column.width ?? 'undefined').toString()}]</b>
        </p>
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          columns={columns}
          onChangeResizeColumn={onChangeResizeColumn}
        />
        <CodeSnippet language="jsx">
          {`
const [columns, setColumns] = useState<TabularColumn[]>(...);

function onChangeColumnResize(widths: number[]) {
  const newColumns = columns.map((column, index) => ({
    ...column,
    width: widths[index],
  }));
  setColumns(newColumns);
}
`}
        </CodeSnippet>
      </Fragment>
    );
  });

  story('Using Custom Cell Rendering', () => {
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
        <CodeSnippet language="tsx">
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
        </CodeSnippet>
      </Fragment>
    );
  });

  story('Table Loading Placeholder', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="TableWidgetVisualization.LoadingPlaceholder" /> can be
          used as a loading placeholder
        </p>
        <TableWidgetVisualization.LoadingPlaceholder />
      </Fragment>
    );
  });
});

const ButtonContainer = styled('div')`
  display: flex;
  justify-content: center;
  margin: 20px;
`;
