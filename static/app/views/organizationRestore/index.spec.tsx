import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import OrganizationRestore from 'sentry/views/organizationRestore';

describe('OrganizationRestore', () => {
  let mockUpdate!: jest.Mock;
  let mockGet!: jest.Mock;
  const pendingDeleteOrg = OrganizationFixture({
    status: {id: 'pending_deletion', name: 'Pending Deletion'},
  });
  const deleteInProgressOrg = OrganizationFixture({
    status: {id: 'deletion_in_progress', name: 'Deletion in progress'},
  });

  beforeEach(() => {
    mockUpdate = MockApiClient.addMockResponse({
      url: `/organizations/${pendingDeleteOrg.slug}/`,
      method: 'PUT',
      status: 200,
      body: OrganizationFixture(),
    });
  });

  it('loads the current organization', async () => {
    mockGet = MockApiClient.addMockResponse({
      url: `/organizations/${pendingDeleteOrg.slug}/`,
      method: 'GET',
      status: 200,
      body: pendingDeleteOrg,
    });
    render(<OrganizationRestore />, {
      organization: pendingDeleteOrg,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${pendingDeleteOrg.slug}/restore/`,
        },
        route: '/organizations/:orgId/restore/',
      },
    });

    const text = await screen.findByText(/currently scheduled for deletion/);
    expect(mockGet).toHaveBeenCalled();
    expect(text).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Restore Organization'})
    ).toBeInTheDocument();
  });

  it('submits update requests', async () => {
    mockGet = MockApiClient.addMockResponse({
      url: `/organizations/${pendingDeleteOrg.slug}/`,
      method: 'GET',
      status: 200,
      body: pendingDeleteOrg,
    });

    render(<OrganizationRestore />, {
      organization: pendingDeleteOrg,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${pendingDeleteOrg.slug}/restore/`,
        },
        route: '/organizations/:orgId/restore/',
      },
    });

    const button = await screen.findByRole('button', {name: 'Restore Organization'});
    await userEvent.click(button);

    expect(mockUpdate).toHaveBeenCalledWith(
      `/organizations/${pendingDeleteOrg.slug}/`,
      expect.objectContaining({
        method: 'PUT',
        data: {cancelDeletion: 1},
      })
    );
    expect(testableWindowLocation.assign).toHaveBeenCalledWith(
      `/organizations/${pendingDeleteOrg.slug}/issues/`
    );
  });

  it('shows the API error when restoring fails', async () => {
    const addErrorMessage = jest.spyOn(indicators, 'addErrorMessage');
    MockApiClient.addMockResponse({
      url: `/organizations/${pendingDeleteOrg.slug}/`,
      method: 'GET',
      status: 200,
      body: pendingDeleteOrg,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${pendingDeleteOrg.slug}/`,
      method: 'PUT',
      statusCode: 400,
      body: {detail: 'This organization can no longer be restored.'},
    });

    render(<OrganizationRestore />, {
      organization: pendingDeleteOrg,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${pendingDeleteOrg.slug}/restore/`,
        },
        route: '/organizations/:orgId/restore/',
      },
    });

    await userEvent.click(
      await screen.findByRole('button', {name: 'Restore Organization'})
    );

    await waitFor(() =>
      expect(addErrorMessage).toHaveBeenCalledWith(
        'Unable to restore organization. This organization can no longer be restored.'
      )
    );
  });

  it('shows message and no form during deletion', async () => {
    mockGet = MockApiClient.addMockResponse({
      url: `/organizations/${deleteInProgressOrg.slug}/`,
      method: 'GET',
      status: 200,
      body: deleteInProgressOrg,
    });

    render(<OrganizationRestore />, {
      organization: deleteInProgressOrg,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${deleteInProgressOrg.slug}/restore/`,
        },
        route: '/organizations/:orgId/restore/',
      },
    });

    const text = await screen.findByText(
      /organization is currently in progress of being deleted/
    );
    expect(text).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Restore Organization'})
    ).not.toBeInTheDocument();
  });
});
