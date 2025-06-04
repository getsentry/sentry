import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SwitchOrganization from 'sentry/components/sidebar/sidebarDropdown/switchOrganization';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import type {Config} from 'sentry/types/system';

describe('SwitchOrganization', function () {
  let configstate: Config;

  beforeEach(() => {
    configstate = ConfigStore.getState();
  });

  afterEach(() => {
    ConfigStore.loadInitialData(configstate);
  });

  it('can list organizations', async function () {
    OrganizationsStore.load([
      OrganizationFixture({name: 'Organization 1'}),
      OrganizationFixture({name: 'Organization 2', slug: 'org2'}),
    ]);

    jest.useFakeTimers();
    render(<SwitchOrganization canCreateOrganization={false} />);

    await userEvent.hover(screen.getByTestId('sidebar-switch-org'), {delay: null});
    act(() => jest.advanceTimersByTime(500));

    expect(screen.getByRole('list')).toBeInTheDocument();

    expect(screen.getByText('Organization 1')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'OS Organization 1'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/'
    );

    expect(screen.getByText('Organization 2')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'O Organization 2'})).toHaveAttribute(
      'href',
      '/organizations/org2/issues/'
    );

    jest.useRealTimers();
  });

  it('uses sentryUrl when customer domain is disabled', async function () {
    ConfigStore.set('features', new Set([]));
    ConfigStore.set('customerDomain', null);

    OrganizationsStore.load([
      OrganizationFixture({name: 'Organization 1', slug: 'org1'}),
      OrganizationFixture({
        name: 'Organization 2',
        slug: 'org2',
        links: {
          organizationUrl: 'http://org2.sentry.io',
          regionUrl: 'http://eu.sentry.io',
        },
      }),
    ]);

    jest.useFakeTimers();
    render(<SwitchOrganization canCreateOrganization={false} />);

    await userEvent.hover(screen.getByTestId('sidebar-switch-org'), {delay: null});
    act(() => jest.advanceTimersByTime(500));

    expect(screen.getByRole('list')).toBeInTheDocument();

    const org1Link = screen.getByRole('link', {name: 'O Organization 1'});
    expect(org1Link).toBeInTheDocument();
    expect(org1Link).toHaveAttribute('href', '/organizations/org1/issues/');

    const org2Link = screen.getByRole('link', {name: 'O Organization 2'});
    expect(org2Link).toBeInTheDocument();
    expect(org2Link).toHaveAttribute('href', '/organizations/org2/issues/');
    jest.useRealTimers();
  });

  it('uses organizationUrl when customer domain enabled', async function () {
    jest.useFakeTimers();
    const currentOrg = OrganizationFixture({
      name: 'Organization 2',
      slug: 'org2',
      links: {
        organizationUrl: 'http://org2.sentry.io',
        regionUrl: 'http://eu.sentry.io',
      },
    });
    ConfigStore.set('features', new Set(['system:multi-region']));
    ConfigStore.set('customerDomain', {
      organizationUrl: 'http://org2.sentry.io',
      sentryUrl: 'http://sentry.io',
      subdomain: 'org2',
    });

    OrganizationsStore.load([
      OrganizationFixture({name: 'Organization 1', slug: 'org1'}),
      currentOrg,
    ]);

    render(<SwitchOrganization canCreateOrganization={false} />, {
      organization: currentOrg,
    });

    await userEvent.hover(screen.getByTestId('sidebar-switch-org'), {delay: null});
    act(() => jest.advanceTimersByTime(500));

    expect(screen.getByRole('list')).toBeInTheDocument();

    const org1Link = screen.getByRole('link', {name: 'O Organization 1'});
    expect(org1Link).toBeInTheDocument();
    // Because multi-region is on and customerDomain has data
    // all organization links will have subdomains
    expect(org1Link).toHaveAttribute('href', 'https://org1.sentry.io/issues/');

    const org2Link = screen.getByRole('link', {name: 'O Organization 2'});
    expect(org2Link).toBeInTheDocument();
    expect(org2Link).toHaveAttribute('href', 'http://org2.sentry.io/issues/');
    jest.useRealTimers();
  });

  it('shows "Create an Org" if they have permission', async function () {
    jest.useFakeTimers();
    render(<SwitchOrganization canCreateOrganization />);

    await userEvent.hover(screen.getByTestId('sidebar-switch-org'), {delay: null});
    act(() => jest.advanceTimersByTime(500));

    expect(screen.getByTestId('sidebar-create-org')).toBeInTheDocument();

    const createOrgLink = screen.getByRole('link', {name: 'Create a new organization'});
    expect(createOrgLink).toBeInTheDocument();
    expect(createOrgLink).toHaveAttribute('href', '/organizations/new/');
    jest.useRealTimers();
  });

  it('does not have "Create an Org" if they do not have permission', async function () {
    jest.useFakeTimers();
    render(<SwitchOrganization canCreateOrganization={false} />);

    await userEvent.hover(screen.getByTestId('sidebar-switch-org'), {delay: null});
    act(() => jest.advanceTimersByTime(500));

    expect(screen.queryByTestId('sidebar-create-org')).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it('uses sentry URL for "Create an Org"', async function () {
    ConfigStore.set('features', new Set(['system:multi-region']));

    const currentOrg = OrganizationFixture({
      name: 'Organization',
      slug: 'org',
      links: {
        organizationUrl: 'http://org.sentry.io',
        regionUrl: 'http://eu.sentry.io',
      },
    });

    jest.useFakeTimers();
    render(<SwitchOrganization canCreateOrganization />, {
      organization: currentOrg,
    });

    await userEvent.hover(screen.getByTestId('sidebar-switch-org'), {delay: null});
    act(() => jest.advanceTimersByTime(500));

    expect(screen.getByTestId('sidebar-create-org')).toBeInTheDocument();

    const createOrgLink = screen.getByRole('link', {name: 'Create a new organization'});
    expect(createOrgLink).toBeInTheDocument();
    expect(createOrgLink).toHaveAttribute('href', 'https://sentry.io/organizations/new/');
    jest.useRealTimers();
  });

  it('shows orgs pending deletion with a special icon', async function () {
    const orgPendingDeletion = OrganizationFixture({
      slug: 'org-2',
      status: {id: 'pending_deletion', name: 'pending_deletion'},
    });

    OrganizationsStore.load([OrganizationFixture(), orgPendingDeletion]);

    jest.useFakeTimers();
    render(<SwitchOrganization canCreateOrganization />);

    await userEvent.hover(screen.getByTestId('sidebar-switch-org'), {delay: null});
    act(() => jest.advanceTimersByTime(500));

    expect(screen.getByTestId('pending-deletion-icon')).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('renders when there is no current organization', async function () {
    OrganizationsStore.load([
      OrganizationFixture({name: 'Organization 1'}),
      OrganizationFixture({name: 'Organization 2', slug: 'org2'}),
    ]);

    // This can occur when disabled members of an organization will not have a current organization.
    jest.useFakeTimers();
    render(<SwitchOrganization canCreateOrganization={false} />);

    await userEvent.hover(screen.getByTestId('sidebar-switch-org'), {delay: null});
    act(() => jest.advanceTimersByTime(500));

    expect(screen.getByRole('list')).toBeInTheDocument();

    expect(screen.getByText('Organization 1')).toBeInTheDocument();
    expect(screen.getByText('Organization 2')).toBeInTheDocument();
    jest.useRealTimers();
  });
});
