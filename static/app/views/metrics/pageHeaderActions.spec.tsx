import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {PageHeaderActions} from 'sentry/views/metrics/pageHeaderActions';

jest.mock('sentry/views/metrics/useCreateDashboard');
jest.mock('sentry/utils/metrics/features', () => ({
  hasCustomMetrics: jest.fn(() => true),
  hasMetricsNewInputs: jest.fn(() => true),
}));

describe('Metrics Page Header Actions', function () {
  describe('add metric buttons', function () {
    it('display "add custom metrics" button', async function () {
      const addCustomMetric = jest.fn();

      render(<PageHeaderActions showAddMetricButton addCustomMetric={addCustomMetric} />);

      const button = screen.getByRole('button', {name: 'Add Custom Metrics'});

      expect(button).toBeInTheDocument();

      await userEvent.click(button);

      expect(addCustomMetric).toHaveBeenCalled();
    });
  });
});
