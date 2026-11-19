import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {toast} from '@sentry/scraps/toast';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import OrganizationServiceAccountsNew from './newServiceAccount';

describe('OrganizationServiceAccountsNew', () => {
  const ENDPOINT = '/organizations/org-slug/service-accounts/';
  const organization = OrganizationFixture({
    access: [
      ...OrganizationFixture().access,
      'event:read',
      'event:write',
      'member:read',
      'service_account:read',
      'service_account:write',
    ],
  });
  const DEFAULT_SCOPES = [
    'event:read',
    'member:read',
    'org:read',
    'project:read',
    'team:read',
  ];

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.spyOn(toast, 'error');
    act(() =>
      ProjectsStore.loadInitialData([
        ProjectFixture({id: '2', slug: 'backend', isMember: true}),
      ])
    );
  });

  it('offers only scopes a service account can hold', async () => {
    render(<OrganizationServiceAccountsNew />, {organization});

    await userEvent.click(screen.getByRole('textbox', {name: 'Permission scopes'}));

    expect(
      screen.getByRole('menuitemcheckbox', {name: 'event:write'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemcheckbox', {name: 'service_account:write'})
    ).not.toBeInTheDocument();
  });

  it('requires at least one scope', async () => {
    const mock = MockApiClient.addMockResponse({url: ENDPOINT, method: 'POST'});

    render(<OrganizationServiceAccountsNew />, {
      organization: OrganizationFixture({access: ['project:write']}),
    });

    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'triage-agent');
    await userEvent.click(screen.getByRole('button', {name: 'Create Service Account'}));

    expect(
      await screen.findByText('Select at least one permission scope.')
    ).toBeInTheDocument();
    expect(mock).not.toHaveBeenCalled();
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

    render(<OrganizationServiceAccountsNew />, {organization});

    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'triage-agent');
    await selectEvent.select(screen.getByRole('textbox', {name: 'Projects'}), 'backend');
    await userEvent.click(screen.getByRole('textbox', {name: 'Permission scopes'}));
    await userEvent.click(screen.getByRole('menuitemcheckbox', {name: 'event:write'}));
    await userEvent.click(screen.getByRole('button', {name: 'Create Service Account'}));

    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          data: {
            name: 'triage-agent',
            scopes: [...DEFAULT_SCOPES, 'event:write'],
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

    render(<OrganizationServiceAccountsNew />, {organization});

    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'deploy');
    await userEvent.click(screen.getByRole('radio', {name: /All projects/}));
    expect(screen.queryByRole('textbox', {name: 'Projects'})).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Create Service Account'}));

    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          data: {
            name: 'deploy',
            scopes: DEFAULT_SCOPES,
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

    render(<OrganizationServiceAccountsNew />, {organization});

    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'deploy');
    await userEvent.click(screen.getByRole('button', {name: 'Create Service Account'}));

    expect(
      await screen.findByText('A service account with this name already exists.')
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
