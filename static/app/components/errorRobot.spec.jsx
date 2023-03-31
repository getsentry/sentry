import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import ErrorRobot from 'sentry/components/errorRobot';

describe('ErrorRobot', function () {
  let getIssues;
  let routerContext;

  beforeEach(function () {
    routerContext = TestStubs.routerContext();
    getIssues = Client.addMockResponse({
      url: '/projects/org-slug/project-slug/issues/',
      method: 'GET',
      body: [],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    Client.clearMockResponses();
  });

  describe('with a project', function () {
    function createWrapper() {
      return render(
        <ErrorRobot
          api={new MockApiClient()}
          org={TestStubs.Organization()}
          project={TestStubs.Project()}
        />,
        {context: routerContext}
      );
    }

    it('Renders a button for creating an event', async function () {
      createWrapper();
      const button = await screen.findByRole('button', {name: 'Create a sample event'});
      expect(button).toBeEnabled();
      expect(getIssues).toHaveBeenCalled();
    });

    it('Renders installation instructions', async function () {
      createWrapper();
      await userEvent.click(screen.getByText('Installation Instructions'));
      expect(routerContext.context.router.push).toHaveBeenCalledWith(
        '/org-slug/project-slug/getting-started/'
      );
    });
  });

  describe('without a project', function () {
    function createWrapper() {
      return render(
        <ErrorRobot api={new MockApiClient()} org={TestStubs.Organization()} />,
        {context: routerContext}
      );
    }

    it('Renders a disabled create event button', function () {
      createWrapper();
      const button = screen.getByRole('button', {name: 'Create a sample event'});
      expect(button).toBeDisabled();
      expect(getIssues).toHaveBeenCalledTimes(0);
    });

    it('does not display install instructions', function () {
      createWrapper();
      expect(screen.queryByText('Installation Instructions')).not.toBeInTheDocument();
    });
  });
});
