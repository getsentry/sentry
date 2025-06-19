import {Fragment} from 'react';

import * as Storybook from 'sentry/stories';
import {
  SAMPLE_EVENT_VIEW,
  SAMPLE_TABLE_RESULTS,
} from 'sentry/views/dashboards/widgets/tableWidget/fixtures/sampleTableResults';
import TableWidgetVisualization from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';

export default Storybook.story('TableWidgetVisualization', story => {
  story('Basic Widget Table', () => {
    return (
      <Fragment>
        <TableWidgetVisualization
          loading={false}
          tableResults={SAMPLE_TABLE_RESULTS}
          eventView={SAMPLE_EVENT_VIEW}
        />
      </Fragment>
    );
  });
});
