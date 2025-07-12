import {AutomationFixture} from 'sentry-fixture/automations';
import {UptimeDetectorFixture} from 'sentry-fixture/detectors';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {UptimeDetectorDetails} from 'sentry/views/detectors/components/details/uptime';

describe('UptimeDetectorDetails', function () {
  const defaultProps = {
    detector: UptimeDetectorFixture(),
    project: ProjectFixture(),
  };

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      method: 'GET',
      body: [AutomationFixture()],
    });
  });

  it('displays correct detector details', async function () {
    render(<UptimeDetectorDetails {...defaultProps} />);

    expect(screen.getByText('Three consecutive failed checks.')).toBeInTheDocument();
    expect(screen.getByText('Three consecutive successful checks.')).toBeInTheDocument();

    // Interval
    expect(screen.getByText('Every 1 minute')).toBeInTheDocument();
    // URL
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    // Method
    expect(screen.getByText('GET')).toBeInTheDocument();
    // Environment
    expect(screen.getByText('production')).toBeInTheDocument();

    // Connected automation
    expect(await screen.findByText('Automation 1')).toBeInTheDocument();

    // Edit button takes you to the edit page
    expect(screen.getByRole('button', {name: 'Edit'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/monitors/3/edit/'
    );
  });
});
