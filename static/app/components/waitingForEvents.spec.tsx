import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import WaitingForEvents from 'sentry/components/waitingForEvents';

describe('WaitingForEvents', function () {
  let getIssues: jest.Func;
  let router: any;

  beforeEach(function () {
    router = RouterFixture();
    getIssues = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/issues/',
      method: 'GET',
      body: [],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  describe('with a project', function () {
    function createWrapper() {
      return render(
        <WaitingForEvents org={OrganizationFixture()} project={ProjectFixture()} />,
        {
          router,
        }
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
      expect(router.push).toHaveBeenCalledWith('/org-slug/project-slug/getting-started/');
    });
  });

  describe('without a project', function () {
    function createWrapper() {
      return render(<WaitingForEvents org={OrganizationFixture()} />, {
        router,
      });
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
