import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {toast} from '@sentry/scraps/toast';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import OrganizationServiceAccountsNew from './newServiceAccount';

describe('OrganizationServiceAccountsNew', () => {
  const ENDPOINT = '/organizations/org-slug/service-accounts/';

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.spyOn(toast, 'error');
    act(() =>
      ProjectsStore.loadInitialData([
        ProjectFixture({id: '2', slug: 'backend', isMember: true}),
      ])
    );
  });

  it('disables create until a permission is picked', () => {
    render(<OrganizationServiceAccountsNew />);

    expect(screen.getByRole('button', {name: 'Create Service Account'})).toBeDisabled();
  });

  it('creates a service account for specific projects', async () => {
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'POST',
      statusCode: 201,
      body: {
        id: '1',
        name: 'triage-agent',
        scopes: ['event:read'],
        projectIds: ['2'],
        allProjects: false,
        dateCreated: '2026-11-05T00:00:00Z',
      },
    });

    render(<OrganizationServiceAccountsNew />);

    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'triage-agent');
    await selectEvent.select(screen.getByRole('textbox', {name: 'Projects'}), 'backend');
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Issue & Event'}),
      'Read'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Create Service Account'}));

    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          data: {
            name: 'triage-agent',
            scopes: ['event:read'],
            allProjects: false,
            projectIds: [2],
          },
        })
      )
    );
  });

  it('creates a service account for all projects', async () => {
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'POST',
      statusCode: 201,
      body: {
        id: '1',
        name: 'deploy',
        scopes: ['project:read'],
        projectIds: [],
        allProjects: true,
        dateCreated: '2026-11-05T00:00:00Z',
      },
    });

    render(<OrganizationServiceAccountsNew />);

    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'deploy');
    await userEvent.click(screen.getByRole('radio', {name: /All projects/}));
    expect(screen.queryByRole('textbox', {name: 'Projects'})).not.toBeInTheDocument();
    await selectEvent.select(screen.getByRole('textbox', {name: 'Project'}), 'Read');
    await userEvent.click(screen.getByRole('button', {name: 'Create Service Account'}));

    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          data: {
            name: 'deploy',
            scopes: ['project:read'],
            allProjects: true,
            projectIds: [],
          },
        })
      )
    );
  });

  it('shows a duplicate name error from the API', async () => {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'POST',
      statusCode: 400,
      body: {detail: {name: ['A service account with this name already exists.']}},
    });

    render(<OrganizationServiceAccountsNew />);

    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'deploy');
    await selectEvent.select(screen.getByRole('textbox', {name: 'Project'}), 'Read');
    await userEvent.click(screen.getByRole('button', {name: 'Create Service Account'}));

    expect(
      await screen.findByText('A service account with this name already exists.')
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
