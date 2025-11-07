import {
  EnvironmentsFixture,
  HiddenEnvironmentsFixture,
} from 'sentry-fixture/environments';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import recreateRoute from 'sentry/utils/recreateRoute';
import ProjectEnvironments from 'sentry/views/settings/project/projectEnvironments';

jest.mock('sentry/utils/recreateRoute');
jest
  .mocked(recreateRoute)
  .mockReturnValue('/org-slug/project-slug/settings/environments/');

function renderComponent(isHidden: boolean) {
  const {organization, project} = initializeOrg();
  const pathname = isHidden
    ? `/settings/projects/${project.slug}/environments/hidden/`
    : `/settings/projects/${project.slug}/environments/`;
  const route = isHidden
    ? '/settings/projects/:projectId/environments/hidden/'
    : '/settings/projects/:projectId/environments/';

  return render(<ProjectEnvironments />, {
    organization,
    outletContext: {project},
    initialRouterConfig: {
      location: {pathname},
      route,
    },
  });
}

describe('ProjectEnvironments', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('render active', () => {
    it('renders empty message', () => {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/environments/',
        body: [],
      });

      renderComponent(false);

      expect(
        screen.getByText("You don't have any environments yet.")
      ).toBeInTheDocument();
    });

    it('renders environment list', () => {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/environments/',
        body: EnvironmentsFixture(),
      });
      renderComponent(false);

      expect(screen.getByText('production')).toBeInTheDocument();
      expect(screen.getAllByRole('button', {name: 'Hide'})).toHaveLength(3);
    });
  });

  describe('render hidden', () => {
    it('renders empty message', () => {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/environments/',
        body: [],
      });

      renderComponent(true);

      expect(
        screen.getByText("You don't have any hidden environments.")
      ).toBeInTheDocument();
    });

    it('renders environment list', () => {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/environments/',
        body: HiddenEnvironmentsFixture(),
      });
      renderComponent(true);

      // Hidden buttons should not have "Set as default"
      expect(screen.getByRole('button', {name: 'Show'})).toBeInTheDocument();
    });
  });

  describe('toggle', () => {
    let hideMock: jest.Mock;
    let showMock: jest.Mock;
    const baseUrl = '/projects/org-slug/project-slug/environments/';
    beforeEach(() => {
      hideMock = MockApiClient.addMockResponse({
        url: `${baseUrl}production/`,
        method: 'PUT',
      });
      showMock = MockApiClient.addMockResponse({
        url: `${baseUrl}zzz/`,
        method: 'PUT',
      });

      MockApiClient.addMockResponse({
        url: baseUrl,
      });
    });

    it('hides', async () => {
      MockApiClient.addMockResponse({
        url: baseUrl,
        body: EnvironmentsFixture(),
      });

      renderComponent(false);

      // Click first row 'hide' (production)
      //
      // XXX(epurkhiser): In the future we should improve the accessability of
      // lists, because right now there's no way to associate the hide button
      // with its environment
      await userEvent.click(screen.getAllByRole('button', {name: 'Hide'})[0]!);

      expect(hideMock).toHaveBeenCalledWith(
        `${baseUrl}production/`,
        expect.objectContaining({
          data: expect.objectContaining({isHidden: true}),
        })
      );
    });

    it('hides names requiring encoding', async () => {
      MockApiClient.addMockResponse({
        url: baseUrl,
        body: [{id: '1', name: '%app_env%', isHidden: false}],
      });

      hideMock = MockApiClient.addMockResponse({
        url: `${baseUrl}%2525app_env%2525/`,
        method: 'PUT',
      });

      renderComponent(false);

      await userEvent.click(screen.getByRole('button', {name: 'Hide'}));

      expect(hideMock).toHaveBeenCalledWith(
        `${baseUrl}%2525app_env%2525/`,
        expect.objectContaining({
          data: expect.objectContaining({isHidden: true}),
        })
      );
    });

    it('shows', async () => {
      MockApiClient.addMockResponse({
        url: baseUrl,
        body: HiddenEnvironmentsFixture(),
      });

      renderComponent(true);

      await userEvent.click(screen.getByRole('button', {name: 'Show'}));

      expect(showMock).toHaveBeenCalledWith(
        `${baseUrl}zzz/`,
        expect.objectContaining({
          data: expect.objectContaining({isHidden: false}),
        })
      );
    });

    it('does not have "All Environments" rows', () => {
      MockApiClient.addMockResponse({
        url: baseUrl,
        body: HiddenEnvironmentsFixture(),
      });

      renderComponent(true);
      expect(screen.queryByText('All Environments')).not.toBeInTheDocument();
    });
  });
});
