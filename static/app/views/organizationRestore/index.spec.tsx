import {Organization} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import OrganizationRestore from 'sentry/views/organizationRestore';

describe('OrganizationRestore', function () {
  let mockUpdate, mockGet;
  const pendingDeleteOrg = Organization({
    status: {id: 'pending_deletion', name: 'Pending Deletion'},
  });
  const deleteInProgressOrg = Organization({
    status: {id: 'deletion_in_progress', name: 'Deletion in progress'},
  });

  beforeEach(() => {
    mockUpdate = MockApiClient.addMockResponse({
      url: `/organizations/${pendingDeleteOrg.slug}/`,
      method: 'PUT',
      status: 200,
      body: Organization(),
    });
  });

  it('loads the current organization', async () => {
    mockGet = MockApiClient.addMockResponse({
      url: `/organizations/${pendingDeleteOrg.slug}/`,
      method: 'GET',
      status: 200,
      body: pendingDeleteOrg,
    });
    const {routerProps, routerContext} = initializeOrg<{orgId: string}>({
      organization: pendingDeleteOrg,
    });
    render(<OrganizationRestore {...routerProps} />, {context: routerContext});

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

    const {routerProps, routerContext} = initializeOrg<{orgId: string}>({
      organization: pendingDeleteOrg,
    });
    render(<OrganizationRestore {...routerProps} />, {context: routerContext});

    const button = await screen.findByTestId('form-submit');
    await userEvent.click(button);

    expect(mockUpdate).toHaveBeenCalled();
    expect(window.location.assign).toHaveBeenCalledWith(
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

    const {routerProps, routerContext} = initializeOrg<{orgId: string}>({
      organization: deleteInProgressOrg,
    });
    render(<OrganizationRestore {...routerProps} />, {context: routerContext});

    const text = await screen.findByText(
      /organization is currently in progress of being deleted/
    );
    expect(text).toBeInTheDocument();
    expect(screen.queryByTestId('form-submit')).not.toBeInTheDocument();
  });
});
