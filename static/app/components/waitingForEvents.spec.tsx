import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import WaitingForEvents from 'sentry/components/waitingForEvents';

describe('WaitingForEvents', () => {
  let getIssues: jest.Func;

  beforeEach(() => {
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

  describe('with a project', () => {
    const props = {
      org: OrganizationFixture(),
      project: ProjectFixture(),
    };

    it('Renders a button for creating an event', async () => {
      render(<WaitingForEvents {...props} />);
      const button = await screen.findByRole('button', {name: 'Create a sample event'});
      expect(button).toBeEnabled();
      expect(getIssues).toHaveBeenCalled();
    });

    it('Renders installation instructions', async () => {
      const {router} = render(<WaitingForEvents {...props} />);
      await userEvent.click(screen.getByText('Installation Instructions'));
      await waitFor(() => {
        expect(router.location.pathname).toBe(
          '/organizations/org-slug/insights/projects/project-slug/getting-started/'
        );
      });
    });
  });

  describe('without a project', () => {
    const props = {
      org: OrganizationFixture(),
    };

    it('Renders a disabled create event button', () => {
      render(<WaitingForEvents {...props} />);
      const button = screen.getByRole('button', {name: 'Create a sample event'});
      expect(button).toBeDisabled();
      expect(getIssues).toHaveBeenCalledTimes(0);
    });

    it('does not display install instructions', () => {
      render(<WaitingForEvents {...props} />);
      expect(screen.queryByText('Installation Instructions')).not.toBeInTheDocument();
    });
  });
});
