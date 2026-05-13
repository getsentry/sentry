import {
  EnvironmentsFixture,
  HiddenEnvironmentsFixture,
} from 'sentry-fixture/environments';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectEnvironments from 'sentry/views/settings/project/projectEnvironments';

function renderComponent(isHidden: boolean) {
  const {organization, project} = initializeOrg();
  const pathname = isHidden
    ? `/settings/${organization.slug}/projects/${project.slug}/environments/hidden/`
    : `/settings/${organization.slug}/projects/${project.slug}/environments/`;
  const route = isHidden
    ? '/settings/:orgId/projects/:projectId/environments/hidden/'
    : '/settings/:orgId/projects/:projectId/environments/';

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
  describe('render active', () => {
    it('renders empty message', async () => {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/environments/',
        body: [],
      });

      renderComponent(false);

      expect(
        await screen.findByText("You don't have any environments yet.")
      ).toBeInTheDocument();
    });

    it('renders environment list', async () => {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/environments/',
        body: EnvironmentsFixture(),
      });
      renderComponent(false);

      expect(await screen.findByText('production')).toBeInTheDocument();
      expect(await screen.findAllByRole('button', {name: 'Hide'})).toHaveLength(3);
    });
  });

  describe('render hidden', () => {
    it('renders empty message', async () => {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/environments/',
        body: [],
      });

      renderComponent(true);

      expect(
        await screen.findByText("You don't have any hidden environments.")
      ).toBeInTheDocument();
    });

    it('renders environment list', async () => {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/environments/',
        body: HiddenEnvironmentsFixture(),
      });
      renderComponent(true);

      // Hidden buttons should not have "Set as default"
      expect(await screen.findByRole('button', {name: 'Show'})).toBeInTheDocument();
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
      await userEvent.click((await screen.findAllByRole('button', {name: 'Hide'}))[0]!);

      expect(hideMock).toHaveBeenCalledWith(
        `${baseUrl}production/`,
        expect.objectContaining({
          data: expect.objectContaining({isHidden: true}),
        })
      );
    });

    it('optimistically removes hidden environments without showing loading state', async () => {
      hideMock = MockApiClient.addMockResponse({
        url: `${baseUrl}production/`,
        method: 'PUT',
        asyncDelay: 50,
      });
      let environmentRequestCount = 0;

      MockApiClient.addMockResponse({
        url: baseUrl,
        body: () => {
          environmentRequestCount += 1;
          return environmentRequestCount === 1
            ? EnvironmentsFixture()
            : EnvironmentsFixture().filter(
                environment => environment.name !== 'production'
              );
        },
      });

      renderComponent(false);

      expect(await screen.findByText('production')).toBeInTheDocument();

      await userEvent.click((await screen.findAllByRole('button', {name: 'Hide'}))[0]!);

      expect(screen.queryByText('production')).not.toBeInTheDocument();
      expect(screen.queryAllByTestId('loading-placeholder')).toHaveLength(0);

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 60));
      });

      expect(screen.queryAllByTestId('loading-placeholder')).toHaveLength(0);
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
        url: `${baseUrl}%25app_env%25/`,
        method: 'PUT',
      });

      renderComponent(false);

      await userEvent.click(await screen.findByRole('button', {name: 'Hide'}));

      expect(hideMock).toHaveBeenCalledWith(
        `${baseUrl}%25app_env%25/`,
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

      await userEvent.click(await screen.findByRole('button', {name: 'Show'}));

      expect(showMock).toHaveBeenCalledWith(
        `${baseUrl}zzz/`,
        expect.objectContaining({
          data: expect.objectContaining({isHidden: false}),
        })
      );
    });

    it('does not have "All Environments" rows', async () => {
      MockApiClient.addMockResponse({
        url: baseUrl,
        body: HiddenEnvironmentsFixture(),
      });

      renderComponent(true);
      await screen.findByRole('button', {name: 'Show'});
      expect(screen.queryByText('All Environments')).not.toBeInTheDocument();
    });
  });
});
