import {Fragment} from 'react';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {Tag} from 'sentry/components/core/badge/tag';
import * as Storybook from 'sentry/stories';
import type {MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
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
          aliases set by user (ex. in dashboards) as well as a static mapping. The util
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

  story('Sorting by Column', () => {
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
          <code>columns</code> prop with the field <code>sortable</code> set to true. Ex.
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
          The default action when a sortable column header is clicked is to update the
          <code>sort</code> location query parameter in the URL. If you wish to override
          the URL update, you can pass <code>onColumnSortChange</code> which accepts a
          <code>Sort</code> object that represents the newly selected sort. This is useful
          if you need to manage internal state:
        </p>
        <CodeSnippet language="tsx">
          {`
// The Sort type
export type Sort = {
  field: string;
  kind: 'asc' | 'desc';
};

// Basic Example
function onColumnSortChange(sort: Sort) {
  setSort(sort)
}
        `}
        </CodeSnippet>
        <p>
          The table will try to automatically parse out the direction from the location
          query parameter and apply the sort direction arrow to the sorted column.
          However, if sorting does not rely on this, or custom sort needs to be used, then
          pass the <code>sort</code> prop to correcly display the sort arrow direction:
        </p>
        <CodeSnippet>
          {`sort={{field: 'count(span.duration)', kind: 'desc'}}`}
        </CodeSnippet>
        <br />
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          sort={{field: 'count(span.duration)', kind: 'desc'}}
          columns={sortableColumns}
        />
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
