import {Fragment} from 'react';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import * as Storybook from 'sentry/stories';
import type {
  TabularColumn,
  TabularData,
  TabularRow,
} from 'sentry/views/dashboards/widgets/common/types';
import {sampleHTTPRequestTableData} from 'sentry/views/dashboards/widgets/tableWidget/fixtures/sampleHTTPRequestTableData';
import {TableWidgetVisualization} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';

export default Storybook.story('TableWidgetVisualization', story => {
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
    const customColumns: TabularColumn[] = [
      {
        key: 'count(span.duration)',
        name: 'Count of Span Duration',
        type: 'number',
        width: -1,
      },
      {
        key: 'http.request_method',
        name: 'HTTP Request Method',
        type: 'string',
        width: -1,
      },
    ];
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
        <p>
          This prop is useful for reordering and giving custom display names to columns:
        </p>
        <CodeSnippet language="json">
          {`
${JSON.stringify(customColumns)}
          `}
        </CodeSnippet>
        <p>Resulting table:</p>
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          columns={customColumns}
        />
      </Fragment>
    );
  });

  story('Using Custom Cell Rendering', () => {
    function customHeadRenderer(column: TabularColumn, _columnIndex: number) {
      return <div>{column.name + ' column'}</div>;
    }
    function customBodyRenderer(
      column: TabularColumn,
      dataRow: TabularRow,
      _rowIndex: number,
      _columnIndex: number
    ) {
      if (column.key === 'http.request_method') {
        return undefined;
      }
      return <div>{dataRow[column.key]}</div>;
    }
    return (
      <Fragment>
        <p>By default, the table falls back on predefined default rendering functions.</p>
        <p>
          If custom cell rendering is required, pass the functions
          <code>renderTableBodyCell</code> and <code>renderTableHeadCell</code>
          which replace the rendering of table body cells and table headers respectively.
          If the function returns <code>undefined</code>, fallback renderer will run
          allowing for partial custom rendering
        </p>
        <p>
          In the below example, a custom header renderer is passed which adds the word
          "column" to each head cell. A custom body renderer is also provided which only
          affects the second column:
        </p>
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          renderTableHeadCell={customHeadRenderer}
          renderTableBodyCell={customBodyRenderer}
        />
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
