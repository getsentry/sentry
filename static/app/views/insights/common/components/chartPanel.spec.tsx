import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ChartPanel from 'sentry/views/insights/common/components/chartPanel';

describe('chartPanel', function () {
  const {organization} = initializeOrg({
    organization: {features: ['insights-alerts', 'insights-initial-modules']},
  });

  it('should render create alert options', async function () {
    const alertConfigs = [
      {
        aggregate: 'avg(d:spans/duration@millisecond)',
        query: 'span.module:db has:span.description',
        name: 'Average DB Duration',
      },
      {
        aggregate: 'spm()',
        query: 'span.module:db has:span.description',
        name: 'DB Spans per minute',
      },
    ];
    render(
      <ChartPanel title="Avg Latency" alertConfigs={alertConfigs}>
        <div />
      </ChartPanel>,
      {organization}
    );
    await userEvent.click(screen.getByLabelText('Chart Actions'));
    screen.getByText('Average DB Duration');
    screen.getByText('DB Spans per minute');
  });
});
