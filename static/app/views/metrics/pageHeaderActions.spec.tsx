import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {PageHeaderActions} from 'sentry/views/metrics/pageHeaderActions';

jest.mock('sentry/views/metrics/useCreateDashboard');

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

    it('display "Create Metric" button', async function () {
      render(
        <PageHeaderActions showAddMetricButton addCustomMetric={() => jest.fn()} />,
        {
          organization: OrganizationFixture({
            features: [
              'custom-metrics-extraction-rule',
              'custom-metrics-extraction-rule-ui',
            ],
          }),
        }
      );
      renderGlobalModal();

      const button = screen.getByRole('button', {name: 'Create Metric'});

      expect(button).toBeInTheDocument();

      await userEvent.click(button);

      expect(
        await screen.findByRole('heading', {name: 'Create Metric'})
      ).toBeInTheDocument();
    });
  });
});
