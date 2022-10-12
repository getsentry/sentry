import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SwitchOrganization} from 'sentry/components/sidebar/sidebarDropdown/switchOrganization';
import {Organization} from 'sentry/types';
import {OrganizationContext} from 'sentry/views/organizationContext';

describe('SwitchOrganization', function () {
  function mountWithOrg(children, organization?: Organization) {
    if (!organization) {
      organization = TestStubs.Organization() as Organization;
    }
    return (
      <OrganizationContext.Provider value={organization}>
        {children}
      </OrganizationContext.Provider>
    );
  }

  it('can list organizations', function () {
    jest.useFakeTimers();
    render(
      mountWithOrg(
        <SwitchOrganization
          canCreateOrganization={false}
          organizations={[
            TestStubs.Organization({name: 'Organization 1'}),
            TestStubs.Organization({name: 'Organization 2', slug: 'org2'}),
          ]}
        />
      )
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
    render(mountWithOrg(<SwitchOrganization canCreateOrganization organizations={[]} />));

    userEvent.hover(screen.getByTestId('sidebar-switch-org'));
    act(() => void jest.advanceTimersByTime(500));

    expect(screen.getByTestId('sidebar-create-org')).toBeInTheDocument();

    const createOrgLink = screen.getByRole('link', {name: 'Create a new organization'});
    expect(createOrgLink).toBeInTheDocument();
    expect(createOrgLink).toHaveAttribute('href', '/organizations/new/');
    jest.useRealTimers();
  });

  it('does not have "Create an Org" if they do not have permission', function () {
    jest.useFakeTimers();
    render(
      mountWithOrg(
        <SwitchOrganization canCreateOrganization={false} organizations={[]} />
      )
    );

    userEvent.hover(screen.getByTestId('sidebar-switch-org'));
    act(() => void jest.advanceTimersByTime(500));

    expect(screen.queryByTestId('sidebar-create-org')).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it('uses sentry URL for "Create an Org"', function () {
    const currentOrg = TestStubs.Organization({
      name: 'Organization',
      slug: 'org',
      links: {
        organizationUrl: 'http://org.sentry.io',
        regionUrl: 'http://eu.sentry.io',
      },
      features: ['customer-domains'],
    });

    jest.useFakeTimers();
    render(
      mountWithOrg(
        <SwitchOrganization canCreateOrganization organizations={[]} />,
        currentOrg
      )
    );

    userEvent.hover(screen.getByTestId('sidebar-switch-org'));
    act(() => void jest.advanceTimersByTime(500));

    expect(screen.getByTestId('sidebar-create-org')).toBeInTheDocument();

    const createOrgLink = screen.getByRole('link', {name: 'Create a new organization'});
    expect(createOrgLink).toBeInTheDocument();
    expect(createOrgLink).toHaveAttribute('href', 'https://sentry.io/organizations/new/');
    jest.useRealTimers();
  });

  it('shows orgs pending deletion with a special icon', function () {
    const orgPendingDeletion = TestStubs.Organization({
      slug: 'org-2',
      status: {id: 'pending_deletion', name: 'pending_deletion'},
    });

    jest.useFakeTimers();
    render(
      mountWithOrg(
        <SwitchOrganization
          canCreateOrganization
          organizations={[TestStubs.Organization(), orgPendingDeletion]}
        />
      )
    );

    userEvent.hover(screen.getByTestId('sidebar-switch-org'));
    act(() => void jest.advanceTimersByTime(500));

    expect(screen.getByTestId('pending-deletion-icon')).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('renders when there is no current organization', function () {
    // This can occur when disabled members of an organization will not have a current organization.
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
});
