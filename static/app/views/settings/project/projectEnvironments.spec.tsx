import {
  EnvironmentsFixture,
  HiddenEnvironmentsFixture,
} from 'sentry-fixture/environments';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

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

function getEnvironmentRow(name: string) {
  const row = screen.getByText(name).closest('[role="row"]');

  if (!(row instanceof HTMLElement)) {
    throw new Error(`Unable to find row for environment: ${name}`);
  }

  return row;
}

async function clickEnvironmentAction(name: string, action: string) {
  await screen.findByText(name);
  await userEvent.click(
    within(getEnvironmentRow(name)).getByRole('button', {name: action})
  );
}

describe('ProjectEnvironments', () => {
  it.each([
    ['active', false, "You don't have any environments yet."],
    ['hidden', true, "You don't have any hidden environments."],
  ])('renders the %s empty state', async (_label, isHidden, message) => {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/environments/',
      body: [],
    });

    renderComponent(isHidden);

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('renders active environments', async () => {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/environments/',
      body: EnvironmentsFixture(),
    });

    renderComponent(false);

    expect(await screen.findByText('production')).toBeInTheDocument();
    expect(screen.getByText('All Environments')).toBeInTheDocument();
    expect(screen.getAllByRole('button', {name: 'Hide'})).toHaveLength(3);
  });

  it.each([
    ['%app_env%', '%2525app_env%2525'],
    ['us%2Feast', 'us%25252Feast'],
  ])('double-encodes environment path params for %s', async (name, encodedName) => {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/environments/',
      body: [{id: '1', name}],
    });
    const hideMock = MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/environments/${encodedName}/`,
      method: 'PUT',
    });

    renderComponent(false);

    await clickEnvironmentAction(name, 'Hide');

    expect(hideMock).toHaveBeenCalledWith(
      `/projects/org-slug/project-slug/environments/${encodedName}/`,
      expect.objectContaining({
        data: expect.objectContaining({isHidden: true}),
      })
    );
  });

  it('renders hidden environments and unhides them', async () => {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/environments/',
      body: HiddenEnvironmentsFixture(),
    });
    const showMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/environments/zzz/',
      method: 'PUT',
    });

    renderComponent(true);

    await clickEnvironmentAction('zzz', 'Show');

    expect(screen.queryByText('All Environments')).not.toBeInTheDocument();
    expect(showMock).toHaveBeenCalledWith(
      '/projects/org-slug/project-slug/environments/zzz/',
      expect.objectContaining({
        data: expect.objectContaining({isHidden: false}),
      })
    );
  });
});
