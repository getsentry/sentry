import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {PageHeaderActions} from 'sentry/views/metrics/pageHeaderActions';

jest.mock('sentry/actionCreators/navigation');
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

    it('display "add new metric" button', async function () {
      render(
        <PageHeaderActions showAddMetricButton addCustomMetric={() => jest.fn()} />,
        {
          organization: OrganizationFixture({
            features: ['custom-metrics-extraction-rule'],
          }),
        }
      );

      const button = screen.getByRole('button', {name: 'Add New Metric'});

      expect(button).toBeInTheDocument();

      await userEvent.click(button);

      expect(navigateTo).toHaveBeenCalledWith(
        `/settings/projects/:projectId/metrics/`,
        expect.objectContaining({
          params: expect.objectContaining({
            projectId: 'project-slug',
          }),
        })
      );
    });
  });
});
