import {Group as GroupFixture} from 'sentry-fixture/group';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Indicator} from 'sentry/views/onboarding/components/firstEventIndicator';

describe('FirstEventIndicator', function () {
  it('renders waiting status', function () {
    const {project, organization} = initializeOrg();

    render(
      <Indicator
        organization={organization}
        project={project}
        firstIssue={null}
        eventType="error"
      />
    );
    expect(
      screen.getByText('Waiting to receive first event to continue')
    ).toBeInTheDocument();
  });

  describe('received first event', function () {
    it('renders', function () {
      const {project, organization} = initializeOrg();

      render(
        <Indicator
          organization={organization}
          project={project}
          eventType="error"
          firstIssue={GroupFixture({id: '1'})}
        />
      );

      expect(screen.getByText('Event was received!')).toBeInTheDocument();
    });

    it('renders without a known issue ID', function () {
      const {project, organization} = initializeOrg();

      render(
        <Indicator
          organization={organization}
          eventType="error"
          project={project}
          firstIssue
        />
      );

      // No button when there is no known issue ID
      expect(screen.getByText('Event was received!')).toBeInTheDocument();
    });
  });
});
