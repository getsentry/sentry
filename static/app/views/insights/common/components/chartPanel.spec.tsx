import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ChartPanel from 'sentry/views/insights/common/components/chartPanel';

describe('chartPanel', function () {
  const {organization} = initializeOrg({
    organization: {features: ['insights-alerts', 'insights-initial-modules']},
  });
  it('should render', function () {
    render(
      <ChartPanel title="Average Duration">
        <div />
      </ChartPanel>,
      {organization}
    );
    expect(screen.getByText('Average Duration')).toBeInTheDocument();
  });
});
