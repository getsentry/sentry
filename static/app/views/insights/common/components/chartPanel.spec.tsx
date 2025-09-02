import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ChartPanel from 'sentry/views/insights/common/components/chartPanel';

describe('chartPanel', () => {
  const {organization} = initializeOrg({
    organization: {features: ['insights-alerts', 'insight-modules']},
  });
  it('should render', () => {
    render(
      <ChartPanel title="Average Duration">
        <div />
      </ChartPanel>,
      {organization}
    );
    expect(screen.getByText('Average Duration')).toBeInTheDocument();
  });
});
