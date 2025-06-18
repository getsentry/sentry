import {Fragment} from 'react';

import * as Storybook from 'sentry/stories';
import {
  SAMPLE_TABLE_COLUMNS,
  SAMPLE_TABLE_RESULTS,
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
        <TableWidgetVisualization
          loading={false}
          tableResults={SAMPLE_TABLE_RESULTS}
          columns={SAMPLE_TABLE_COLUMNS}
        />
      </Fragment>
    );
  });

  story('Custom Styling', () => {
    return (
      <Fragment>
        <p>
          Passing <Storybook.JSXProperty name="renderTableBodyCell" value="function" />{' '}
          and <Storybook.JSXProperty name="renderTableHeadCell" value="function" /> allows
          for custom cell elements to be injected into the table. This is useful if there
          are distinct field renderers needed to properly format cells
        </p>
        <TableWidgetVisualization
          loading={false}
          tableResults={SAMPLE_TABLE_RESULTS}
          columns={SAMPLE_TABLE_COLUMNS}
        />
      </Fragment>
    );
  });

  story('Using Custom Cell Rendering', () => {
    return (
      <Fragment>
        <p>
          Passing <Storybook.JSXProperty name="renderTableBodyCell" value="function" />{' '}
          and <Storybook.JSXProperty name="renderTableHeadCell" value="function" /> allows
          for custom cell elements to be injected into the table. This is useful if there
          are distinct field renderers needed to properly format cells
        </p>
        <TableWidgetVisualization
          loading={false}
          tableResults={SAMPLE_TABLE_RESULTS}
          columns={SAMPLE_TABLE_COLUMNS}
        />
      </Fragment>
    );
  });
});
