import {Organization} from 'sentry-fixture/organization';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SwitchOrganization} from 'sentry/components/sidebar/sidebarDropdown/switchOrganization';

describe('SwitchOrganization', function () {
  const routerContext = RouterContextFixture();
  it('can list organizations', async function () {
    jest.useFakeTimers();
    render(
      <SwitchOrganization
        canCreateOrganization={false}
        organizations={[
          Organization({name: 'Organization 1'}),
          Organization({name: 'Organization 2', slug: 'org2'}),
        ]}
      />,
      {context: RouterContextFixture()}
    );

    await userEvent.hover(screen.getByTestId('sidebar-switch-org'), {delay: null});
    act(() => jest.advanceTimersByTime(500));

    expect(screen.getByRole('list')).toBeInTheDocument();

    expect(screen.getByText('Organization 1')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'org slug Organization 1'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/'
    );

    expect(screen.getByText('Organization 2')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'org2 Organization 2'})).toHaveAttribute(
      'href',
      '/organizations/org2/issues/'
    );

    jest.useRealTimers();
  });

  it('uses organizationUrl when customer domain is enabled', async function () {
    jest.useFakeTimers();
    render(
      <SwitchOrganization
        canCreateOrganization={false}
        organizations={[
          Organization({name: 'Organization 1', slug: 'org1'}),
          Organization({
            name: 'Organization 2',
            slug: 'org2',
            links: {
              organizationUrl: 'http://org2.sentry.io',
              regionUrl: 'http://eu.sentry.io',
            },
            features: ['customer-domains'],
          }),
        ]}
      />,
      {context: routerContext}
    );

    await userEvent.hover(screen.getByTestId('sidebar-switch-org'), {delay: null});
    act(() => jest.advanceTimersByTime(500));

    expect(screen.getByRole('list')).toBeInTheDocument();

    const org1Link = screen.getByRole('link', {name: 'org1 Organization 1'});
    expect(org1Link).toBeInTheDocument();
    expect(org1Link).toHaveAttribute('href', '/organizations/org1/issues/');

    const org2Link = screen.getByRole('link', {name: 'org2 Organization 2'});
    expect(org2Link).toBeInTheDocument();
    expect(org2Link).toHaveAttribute(
      'href',
      'http://org2.sentry.io/organizations/org2/issues/'
    );
    jest.useRealTimers();
  });

  it('does not use organizationUrl when customer domain is disabled', async function () {
    jest.useFakeTimers();
    render(
      <SwitchOrganization
        canCreateOrganization={false}
        organizations={[
          Organization({name: 'Organization 1', slug: 'org1'}),
          Organization({
            name: 'Organization 2',
            slug: 'org2',
            links: {
              organizationUrl: 'http://org2.sentry.io',
              regionUrl: 'http://eu.sentry.io',
            },
            features: [],
          }),
        ]}
      />,
      {context: routerContext}
    );

    await userEvent.hover(screen.getByTestId('sidebar-switch-org'), {delay: null});
    act(() => jest.advanceTimersByTime(500));

    expect(screen.getByRole('list')).toBeInTheDocument();

    const org1Link = screen.getByRole('link', {name: 'org1 Organization 1'});
    expect(org1Link).toBeInTheDocument();
    expect(org1Link).toHaveAttribute('href', '/organizations/org1/issues/');

    const org2Link = screen.getByRole('link', {name: 'org2 Organization 2'});
    expect(org2Link).toBeInTheDocument();
    expect(org2Link).toHaveAttribute('href', '/organizations/org2/issues/');
    jest.useRealTimers();
  });

  it('uses sentryUrl when current org has customer domain enabled', async function () {
    jest.useFakeTimers();
    const currentOrg = Organization({
      name: 'Organization 2',
      slug: 'org2',
      links: {
        organizationUrl: 'http://org2.sentry.io',
        regionUrl: 'http://eu.sentry.io',
      },
      features: ['customer-domains'],
    });
    render(
      <SwitchOrganization
        canCreateOrganization={false}
        organizations={[Organization({name: 'Organization 1', slug: 'org1'}), currentOrg]}
      />,
      {organization: currentOrg}
    );

    await userEvent.hover(screen.getByTestId('sidebar-switch-org'), {delay: null});
    act(() => jest.advanceTimersByTime(500));

    expect(screen.getByRole('list')).toBeInTheDocument();

    const org1Link = screen.getByRole('link', {name: 'org1 Organization 1'});
    expect(org1Link).toBeInTheDocument();
    // Current hostname in the URL is expected to be org2.sentry.io, so we need to make use of sentryUrl to link to an
    // organization that does not support customer domains.
    expect(org1Link).toHaveAttribute(
      'href',
      'https://sentry.io/organizations/org1/issues/'
    );

    const org2Link = screen.getByRole('link', {name: 'org2 Organization 2'});
    expect(org2Link).toBeInTheDocument();
    expect(org2Link).toHaveAttribute(
      'href',
      'http://org2.sentry.io/organizations/org2/issues/'
    );
    jest.useRealTimers();
  });

  it('does not use sentryUrl when current org does not have customer domain feature', async function () {
    jest.useFakeTimers();
    const currentOrg = Organization({
      name: 'Organization 2',
      slug: 'org2',
      links: {
        organizationUrl: 'http://org2.sentry.io',
        regionUrl: 'http://eu.sentry.io',
      },
      features: [],
    });
    render(
      <SwitchOrganization
        canCreateOrganization={false}
        organizations={[
          Organization({name: 'Organization 1', slug: 'org1'}),
          Organization({
            name: 'Organization 3',
            slug: 'org3',
            links: {
              organizationUrl: 'http://org3.sentry.io',
              regionUrl: 'http://eu.sentry.io',
            },
            features: ['customer-domains'],
          }),
        ]}
      />,
      {organization: currentOrg, context: routerContext}
    );

    await userEvent.hover(screen.getByTestId('sidebar-switch-org'), {delay: null});
    act(() => jest.advanceTimersByTime(500));

    expect(screen.getByRole('list')).toBeInTheDocument();

    const org1Link = screen.getByRole('link', {name: 'org1 Organization 1'});
    expect(org1Link).toBeInTheDocument();
    expect(org1Link).toHaveAttribute('href', '/organizations/org1/issues/');

    const org3Link = screen.getByRole('link', {name: 'org3 Organization 3'});
    expect(org3Link).toBeInTheDocument();
    expect(org3Link).toHaveAttribute(
      'href',
      'http://org3.sentry.io/organizations/org3/issues/'
    );
    jest.useRealTimers();
  });

  it('shows "Create an Org" if they have permission', async function () {
    jest.useFakeTimers();
    render(<SwitchOrganization canCreateOrganization organizations={[]} />, {
      context: routerContext,
    });

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
    render(<SwitchOrganization canCreateOrganization={false} organizations={[]} />);

    await userEvent.hover(screen.getByTestId('sidebar-switch-org'), {delay: null});
    act(() => jest.advanceTimersByTime(500));

    expect(screen.queryByTestId('sidebar-create-org')).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it('uses sentry URL for "Create an Org"', async function () {
    const currentOrg = Organization({
      name: 'Organization',
      slug: 'org',
      links: {
        organizationUrl: 'http://org.sentry.io',
        regionUrl: 'http://eu.sentry.io',
      },
      features: ['customer-domains'],
    });

    jest.useFakeTimers();
    render(<SwitchOrganization canCreateOrganization organizations={[]} />, {
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
    const orgPendingDeletion = Organization({
      slug: 'org-2',
      status: {id: 'pending_deletion', name: 'pending_deletion'},
    });

    jest.useFakeTimers();
    render(
      <SwitchOrganization
        canCreateOrganization
        organizations={[Organization(), orgPendingDeletion]}
      />
    );

    await userEvent.hover(screen.getByTestId('sidebar-switch-org'), {delay: null});
    act(() => jest.advanceTimersByTime(500));

    expect(screen.getByTestId('pending-deletion-icon')).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('renders when there is no current organization', async function () {
    // This can occur when disabled members of an organization will not have a current organization.
    jest.useFakeTimers();
    render(
      <SwitchOrganization
        canCreateOrganization={false}
        organizations={[
          Organization({name: 'Organization 1'}),
          Organization({name: 'Organization 2', slug: 'org2'}),
        ]}
      />
    );

    await userEvent.hover(screen.getByTestId('sidebar-switch-org'), {delay: null});
    act(() => jest.advanceTimersByTime(500));

    expect(screen.getByRole('list')).toBeInTheDocument();

    expect(screen.getByText('Organization 1')).toBeInTheDocument();
    expect(screen.getByText('Organization 2')).toBeInTheDocument();
    jest.useRealTimers();
  });
});
