import {Fragment} from 'react';

import * as Storybook from 'sentry/stories';
import {sampleHTTPRequestTableData} from 'sentry/views/dashboards/widgets/tableWidget/fixtures/sampleTableData';
import {TableWidgetVisualization} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';
import type {TableColumn} from 'sentry/views/discover/table/types';

const TABLE_COLUMNS: Array<TableColumn<string>> = [
  {
    key: 'http.request_method',
    name: 'http.request_method',
    type: 'never',
    isSortable: false,
    column: {
      kind: 'field',
      field: 'http.request_method',
      alias: '',
    },
    width: -1,
  },
  {
    key: 'count(span.duration)',
    name: 'count(span.duration)',
    type: 'number',
    isSortable: true,
    column: {
      kind: 'function',
      function: ['count', 'span.duration', undefined, undefined],
      alias: '',
    },
    width: -1,
  },
];

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
          <code>columns</code> and <code>tableData</code> populating the table headers and
          table body respectively.
        </p>
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          columns={TABLE_COLUMNS}
        />
      </Fragment>
    );
  });

  story('Table Columns and Table Data', () => {
    return (
      <Fragment>
        <p>
          Currently, the columns use the type <code>TableColumn[]</code> and are rendered
          in the order they are supplied. The table data uses the type{' '}
          <code>TabularData</code>.
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
          return an undefined value, in which case the fallback renderer will run allowing
          for partial custom rendering
        </p>
        <p>Ex. (to update...)</p>
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          columns={TABLE_COLUMNS}
        />
      </Fragment>
    );
  });

  story('Widget Frame styles', () => {
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
          columns={TABLE_COLUMNS}
          applyWidgetFrameStyle
        />
      </Fragment>
    );
  });

  story('Table Loading', () => {
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
