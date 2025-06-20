import {Fragment} from 'react';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import * as Storybook from 'sentry/stories';
import {sampleHTTPRequestTableData} from 'sentry/views/dashboards/widgets/tableWidget/fixtures/sampleTableData';
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
    return (
      <Fragment>
        <p>
          The table data uses the type
          <code>TabularData</code>. This is a mandatory prop. If the <code>data</code>{' '}
          field is empty, such as
        </p>
        <CodeSnippet language="json">
          {`
{
  data: [],
  meta: {
    fields: {'http.request_method': 'string', 'count(span.duration)': 'number'},
    units: {'http.request_method': null, 'count(span.duration)': null},
  },
}
          `}
        </CodeSnippet>
        <p>Then the table renders empty like this:</p>
        <TableWidgetVisualization
          tableData={{
            data: [],
            meta: {
              fields: {'http.request_method': 'string', 'count(span.duration)': 'number'},
              units: {'http.request_method': null, 'count(span.duration)': null},
            },
          }}
        />
        <p>
          The table columns use the type <code>TabularColumn[]</code> which is based off
          of <code>GridColumnOrder</code> from <Storybook.JSXNode name="GridEditable" />.
          Supplying the prop allows for custom ordering of the columns. The prop is
          optional, as the table will fallback to extract the columns in order from the
          table data's <code>meta.fields</code>, displaying them as shown above.
        </p>
      </Fragment>
    );
  });

  story('Using Custom Cell Rendering', () => {
    return (
      <Fragment>
        <p>By default, the table falls back on predefined default rendering functions.</p>
        <p>
          If custom cell rendering is required, pass the functions
          <code>renderTableBodyCell</code> and <code>renderTableHeadCell</code>
          which replace the rendering of table body cells and table headers respectively.
          These functions should return a <code>React.ReactNode</code>, but are allowed to
          return an <code>undefined</code> value, in which case the fallback renderer will
          run allowing for partial custom rendering
        </p>
        <p>Ex. (to update...)</p>
        <TableWidgetVisualization tableData={sampleHTTPRequestTableData} />
      </Fragment>
    );
  });

  story('Widget Frame Styles', () => {
    return (
      <Fragment>
        <p>
          This table can also be used in widget frames (ex. the widgets on a dashboard),
          which have different styling (no borders on the side and no rounded top
          corners). Use{' '}
          <Storybook.JSXProperty name="applyWidgetFrameStyle" value={Boolean} /> to apply
          these styles to the table
        </p>
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          applyWidgetFrameStyle
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
