import {Fragment} from 'react';

import * as Storybook from 'sentry/stories';
import {
  SAMPLE_TABLE_COLUMNS,
  SAMPLE_TABLE_DATA,
} from 'sentry/views/dashboards/widgets/tableWidget/fixtures/sampleTableResults';
import TableWidgetVisualization from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';

export default Storybook.story('TableWidgetVisualization', story => {
  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="TableWidgetVisualization" /> is meant to be a robust
          and eventual replacement to all tables in Dashboards and Insights (and
          potentially more). The inner component of this table is{' '}
          <Storybook.JSXNode name="GridEditable" />.
        </p>
        <p>
          Below is the the most basic example of the table which requires
          <code>columns</code> and <code>tableData</code> populating the table headers and
          table body respectively.
        </p>
        <TableWidgetVisualization
          loading={false}
          tableData={SAMPLE_TABLE_DATA}
          columns={SAMPLE_TABLE_COLUMNS}
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
          <code>TableData</code>.
        </p>
      </Fragment>
    );
  });

  story('Using Custom Cell Rendering', () => {
    return (
      <Fragment>
        <p>By default, the table falls back on predefined default rendering functions.</p>
        <p>
          If custom cell rendering is required, pass
          <Storybook.JSXProperty name="renderTableBodyCell" value="function" /> and{' '}
          <Storybook.JSXProperty name="renderTableHeadCell" value="function" /> which
          replace the rendering of table body cells and table headers respectively
        </p>
        <p>Ex. (to update...)</p>
        <TableWidgetVisualization
          loading={false}
          tableData={SAMPLE_TABLE_DATA}
          columns={SAMPLE_TABLE_COLUMNS}
        />
      </Fragment>
    );
  });

  story('Custom Styling', () => {
    return (
      <Fragment>
        <p>
          The underlying <Storybook.JSXNode name="GridEditable" /> component allows for
          several useful styling props to be used to format the table. Similarly, this
          table allow allows for users to pass any overriding styles.
        </p>
        <p>Ex. we can pass custom styles to remove the border of the table:</p>
        <TableWidgetVisualization
          loading={false}
          tableData={SAMPLE_TABLE_DATA}
          columns={SAMPLE_TABLE_COLUMNS}
          style={{border: 'none'}}
        />
      </Fragment>
    );
  });
});
