import {
  Environments as EnvironmentsFixture,
  HiddenEnvironments,
} from 'sentry-fixture/environments';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import recreateRoute from 'sentry/utils/recreateRoute';
import ProjectEnvironments from 'sentry/views/settings/project/projectEnvironments';

jest.mock('sentry/utils/recreateRoute');
jest
  .mocked(recreateRoute)
  .mockReturnValue('/org-slug/project-slug/settings/environments/');

function renderComponent(isHidden: boolean) {
  const {organization, project, routerProps} = initializeOrg();
  const pathname = isHidden ? 'environments/hidden/' : 'environments/';

  return render(
    <ProjectEnvironments
      {...routerProps}
      params={{projectId: project.slug}}
      location={LocationFixture({pathname})}
      organization={organization}
      project={project}
    />
  );
}

describe('ProjectEnvironments', function () {
  const project = ProjectFixture({
    defaultEnvironment: 'production',
  });

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      body: project,
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('render active', function () {
    it('renders empty message', function () {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/environments/',
        body: [],
      });

      renderComponent(false);

      expect(
        screen.getByText("You don't have any environments yet.")
      ).toBeInTheDocument();
    });

    it('renders environment list', function () {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/environments/',
        body: EnvironmentsFixture(),
      });
      renderComponent(false);

      expect(screen.getByText('production')).toBeInTheDocument();
      expect(screen.getAllByRole('button', {name: 'Hide'})).toHaveLength(3);
    });
  });

  describe('render hidden', function () {
    it('renders empty message', function () {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/environments/',
        body: [],
      });

      renderComponent(true);

      expect(
        screen.getByText("You don't have any hidden environments.")
      ).toBeInTheDocument();
    });

    it('renders environment list', function () {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/environments/',
        body: HiddenEnvironments(),
      });
      renderComponent(true);

      // Hidden buttons should not have "Set as default"
      expect(screen.getByRole('button', {name: 'Show'})).toBeInTheDocument();
    });
  });

  describe('toggle', function () {
    let hideMock: jest.Mock;
    let showMock: jest.Mock;
    const baseUrl = '/projects/org-slug/project-slug/environments/';
    beforeEach(function () {
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

    it('hides', async function () {
      MockApiClient.addMockResponse({
        url: baseUrl,
        body: EnvironmentsFixture(),
      });

      renderComponent(false);

      // Click first row 'hide' (production)
      //
      // XXX(epurkhiser): In the future we should improve the accessability of
      // lists, because right now there's no way to associate the hide button
      // with it's environment
      await userEvent.click(screen.getAllByRole('button', {name: 'Hide'})[0]);

      expect(hideMock).toHaveBeenCalledWith(
        `${baseUrl}production/`,
        expect.objectContaining({
          data: expect.objectContaining({isHidden: true}),
        })
      );
    });

    it('hides names requiring encoding', async function () {
      MockApiClient.addMockResponse({
        url: baseUrl,
        body: [{id: '1', name: '%app_env%', isHidden: false}],
      });

      hideMock = MockApiClient.addMockResponse({
        url: `${baseUrl}%25app_env%25/`,
        method: 'PUT',
      });

      renderComponent(false);

      await userEvent.click(screen.getByRole('button', {name: 'Hide'}));

      expect(hideMock).toHaveBeenCalledWith(
        `${baseUrl}%25app_env%25/`,
        expect.objectContaining({
          data: expect.objectContaining({isHidden: true}),
        })
      );
    });

    it('shows', async function () {
      MockApiClient.addMockResponse({
        url: baseUrl,
        body: HiddenEnvironments(),
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

    it('does not have "All Environments" rows', function () {
      MockApiClient.addMockResponse({
        url: baseUrl,
        body: HiddenEnvironments(),
      });

      renderComponent(true);
      expect(screen.queryByText('All Environments')).not.toBeInTheDocument();
    });
  });
});
