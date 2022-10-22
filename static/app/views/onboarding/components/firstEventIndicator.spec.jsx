import {ProjectDetails} from 'fixtures/js-stubs/projectDetails';
import {Organization} from 'fixtures/js-stubs/organization';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Indicator} from 'sentry/views/onboarding/components/firstEventIndicator';

describe('FirstEventIndicator', function () {
  it('renders waiting status', function () {
    const org = Organization();

    render(<Indicator organization={org} firstIssue={null} />);
    expect(
      screen.getByText('Waiting to receive first event to continue')
    ).toBeInTheDocument();
  });

  describe('received first event', function () {
    it('renders', function () {
      const org = Organization();

      render(<Indicator organization={org} firstIssue={{id: 1}} />);

      expect(screen.getByText('Event was received!')).toBeInTheDocument();
    });

    it('renders without a known issue ID', function () {
      const org = Organization();
      const project = ProjectDetails({});

      render(<Indicator organization={org} project={project} firstIssue />);

      // No button when there is no known issue ID
      expect(screen.getByText('Event was received!')).toBeInTheDocument();
    });
  });
});
