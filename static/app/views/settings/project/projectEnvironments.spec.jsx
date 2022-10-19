import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import recreateRoute from 'sentry/utils/recreateRoute';
import ProjectEnvironments from 'sentry/views/settings/project/projectEnvironments';

jest.mock('sentry/utils/recreateRoute');
recreateRoute.mockReturnValue('/org-slug/project-slug/settings/environments/');

function renderComponent(isHidden) {
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  const pathname = isHidden ? 'environments/hidden/' : 'environments/';
  return render(
    <ProjectEnvironments
      params={{
        orgId: org.slug,
        projectId: project.slug,
      }}
      location={{pathname}}
      routes={[]}
    />
  );
}

describe('ProjectEnvironments', function () {
  let project;

  beforeEach(function () {
    project = TestStubs.Project({
      defaultEnvironment: 'production',
    });
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

      const {container} = renderComponent(false);

      expect(
        screen.getByText("You don't have any environments yet.")
      ).toBeInTheDocument();

      expect(container).toSnapshot();
    });

    it('renders environment list', function () {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/environments/',
        body: TestStubs.Environments(false),
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

      const {container} = renderComponent(true);

      expect(
        screen.getByText("You don't have any hidden environments.")
      ).toBeInTheDocument();

      expect(container).toSnapshot();
    });

    it('renders environment list', function () {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/environments/',
        body: TestStubs.Environments(true),
      });
      const {container} = renderComponent(true);

      // Hidden buttons should not have "Set as default"
      expect(screen.getByRole('button', {name: 'Show'})).toBeInTheDocument();
      expect(container).toSnapshot();
    });
  });

  describe('toggle', function () {
    let hideMock, showMock;
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

    it('hides', function () {
      MockApiClient.addMockResponse({
        url: baseUrl,
        body: TestStubs.Environments(false),
      });

      renderComponent(false);

      // Click first row 'hide' (production)
      //
      // XXX(epurkhiser): In the future we should improve the accessability of
      // lists, because right now there's no way to associate the hide button
      // with it's environment
      userEvent.click(screen.getAllByRole('button', {name: 'Hide'})[0]);

      expect(hideMock).toHaveBeenCalledWith(
        `${baseUrl}production/`,
        expect.objectContaining({
          data: expect.objectContaining({isHidden: true}),
        })
      );
    });

    it('hides names requiring encoding', function () {
      MockApiClient.addMockResponse({
        url: baseUrl,
        body: [{id: '1', name: '%app_env%', isHidden: false}],
      });

      hideMock = MockApiClient.addMockResponse({
        url: `${baseUrl}%25app_env%25/`,
        method: 'PUT',
      });

      renderComponent(false);

      userEvent.click(screen.getByRole('button', {name: 'Hide'}));

      expect(hideMock).toHaveBeenCalledWith(
        `${baseUrl}%25app_env%25/`,
        expect.objectContaining({
          data: expect.objectContaining({isHidden: true}),
        })
      );
    });

    it('shows', function () {
      MockApiClient.addMockResponse({
        url: baseUrl,
        body: TestStubs.Environments(true),
      });

      renderComponent(true);

      userEvent.click(screen.getByRole('button', {name: 'Show'}));

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
        body: TestStubs.Environments(true),
      });

      renderComponent(true);
      expect(screen.queryByText('All Environments')).not.toBeInTheDocument();
    });
  });
});
