import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SwitchOrganization} from 'sentry/components/sidebar/sidebarDropdown/switchOrganization';

describe('SwitchOrganization', function () {
  it('can list organizations', function () {
    jest.useFakeTimers();
    render(
      <SwitchOrganization
        canCreateOrganization={false}
        organizations={[
          TestStubs.Organization({name: 'Organization 1'}),
          TestStubs.Organization({name: 'Organization 2', slug: 'org2'}),
        ]}
      />
    );

    userEvent.hover(screen.getByTestId('sidebar-switch-org'));
    act(() => void jest.advanceTimersByTime(500));

    expect(screen.getByRole('list')).toBeInTheDocument();

    expect(screen.getByText('Organization 1')).toBeInTheDocument();
    expect(screen.getByText('Organization 2')).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('shows "Create an Org" if they have permission', function () {
    jest.useFakeTimers();
    render(<SwitchOrganization canCreateOrganization organizations={[]} />);

    userEvent.hover(screen.getByTestId('sidebar-switch-org'));
    act(() => void jest.advanceTimersByTime(500));

    expect(screen.getByTestId('sidebar-create-org')).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('does not have "Create an Org" if they do not have permission', function () {
    jest.useFakeTimers();
    render(<SwitchOrganization canCreateOrganization={false} organizations={[]} />);

    userEvent.hover(screen.getByTestId('sidebar-switch-org'));
    act(() => void jest.advanceTimersByTime(500));

    expect(screen.queryByTestId('sidebar-create-org')).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it('shows orgs pending deletion with a special icon', function () {
    const orgPendingDeletion = TestStubs.Organization({
      slug: 'org-2',
      status: {id: 'pending_deletion', name: 'pending_deletion'},
    });

    jest.useFakeTimers();
    render(
      <SwitchOrganization
        canCreateOrganization
        organizations={[TestStubs.Organization(), orgPendingDeletion]}
      />
    );

    userEvent.hover(screen.getByTestId('sidebar-switch-org'));
    act(() => void jest.advanceTimersByTime(500));

    expect(screen.getByTestId('pending-deletion-icon')).toBeInTheDocument();
    jest.useRealTimers();
  });
});
