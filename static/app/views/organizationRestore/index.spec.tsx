import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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
    expect(screen.getByTestId('form-submit')).toBeInTheDocument();
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

    const button = await screen.findByTestId('form-submit');
    await userEvent.click(button);

    expect(mockUpdate).toHaveBeenCalled();
    expect(testableWindowLocation.assign).toHaveBeenCalledWith(
      `/organizations/${pendingDeleteOrg.slug}/issues/`
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
    expect(screen.queryByTestId('form-submit')).not.toBeInTheDocument();
  });
});
