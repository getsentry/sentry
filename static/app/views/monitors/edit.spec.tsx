import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';

import EditMonitor from './edit';

describe('EditMonitor', function () {
  const monitorSlug = 'my-monitor';

  const {organization, routerContext} = initializeOrg({
    router: {params: {monitorSlug}},
  });

  beforeEach(function () {
    OrganizationStore.onUpdate(organization, {replace: true});
    ProjectsStore.loadInitialData([TestStubs.Project()]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitors/${monitorSlug}/`,
      body: TestStubs.Monitor(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      body: [TestStubs.Team()],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/user-teams/`,
      body: [TestStubs.Team()],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      body: [TestStubs.Member()],
    });
  });

  it('shows existing monitor details', async function () {
    render(<EditMonitor />, {context: routerContext, organization});

    const crumbs = await screen.findByRole('navigation');
    expect(within(crumbs).getByRole('link', {name: 'Crons'})).toBeInTheDocument();
    expect(within(crumbs).getByRole('link', {name: 'My Monitor'})).toBeInTheDocument();

    expect(screen.getByRole('textbox', {name: 'Name'})).toHaveValue('My Monitor');
    expect(screen.getByRole('textbox', {name: 'Slug'})).toHaveValue('my-monitor');
    expect(screen.getByRole('textbox', {name: 'Project'})).toBeDisabled();

    // TODO: Why can't I test selected project?
    // expect(screen.getByRole('textbox', {name: 'Project'})).toHaveValue('project-slug');

    const scheduleType = screen.getByRole('radiogroup', {name: 'Schedule Type'});
    expect(within(scheduleType).getByRole('radio', {name: 'Crontab'})).toBeChecked();

    expect(screen.getByRole('textbox', {name: 'Crontab schedule'})).toHaveValue(
      '0 0 * * *'
    );

    // TOOD check UTC

    expect(screen.getByRole('spinbutton', {name: 'Check-in margin'})).toHaveValue(5);
    expect(screen.getByRole('spinbutton', {name: 'Max runtime'})).toHaveValue(20);
  });

  it('updates the monitor name', async function () {
    render(<EditMonitor />, {context: routerContext, organization});
    await screen.findByRole('navigation');

    const updateMonitor = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitors/${monitorSlug}/`,
      method: 'PUT',
      body: TestStubs.Monitor({name: 'New Monitor Name'}),
    });

    const nameInput = screen.getByRole('textbox', {name: 'Name'});

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'New Monitor Name', {});
    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    expect(updateMonitor).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/monitors/${monitorSlug}/`,
      expect.objectContaining({
        data: expect.objectContaining({name: 'New Monitor Name'}),
      })
    );
  });

  it('redirects correctly when changing the slug', async function () {
    render(<EditMonitor />, {context: routerContext, organization});
    await screen.findByRole('navigation');

    const updateMonitor = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitors/${monitorSlug}/`,
      method: 'PUT',
      body: TestStubs.Monitor({slug: 'new-slug'}),
    });

    const nameInput = screen.getByRole('textbox', {name: 'Slug'});

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'new-slug', {});
    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    expect(updateMonitor).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/monitors/${monitorSlug}/`,
      expect.objectContaining({
        data: expect.objectContaining({name: 'New Monitor Name'}),
      })
    );
  });
});
