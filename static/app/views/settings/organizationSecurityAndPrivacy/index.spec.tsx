import {InjectedRouter} from 'react-router';
import {Location} from 'history';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';
import {Organization} from 'sentry/types';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';
import OrganizationSecurityAndPrivacy from 'sentry/views/settings/organizationSecurityAndPrivacy';

function ComponentProviders({
  router,
  location,
  organization,
  children,
}: {
  children: React.ReactNode;
  location: Location;
  organization: Organization;
  router: InjectedRouter;
}) {
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/auth-provider/`,
    method: 'GET',
    body: {},
  });

  return (
    <OrganizationContext.Provider value={organization}>
      <RouteContext.Provider
        value={{
          router,
          location,
          params: {},
          routes: [],
        }}
      >
        {children}
      </RouteContext.Provider>
    </OrganizationContext.Provider>
  );
}

describe('OrganizationSecurityAndPrivacy', function () {
  it('shows require2fa switch', async function () {
    const {organization, router} = initializeOrg();

    render(
      <ComponentProviders
        organization={organization}
        router={router}
        location={router.location}
      >
        <OrganizationSecurityAndPrivacy />
      </ComponentProviders>
    );

    expect(
      await screen.findByRole('checkbox', {
        name: 'Enable to require and enforce two-factor authentication for all members',
      })
    ).toBeInTheDocument();
  });

  it('returns to "off" if switch enable fails (e.g. API error)', async function () {
    const {organization, router} = initializeOrg();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      statusCode: 500,
    });

    render(
      <ComponentProviders
        organization={organization}
        router={router}
        location={router.location}
      >
        <GlobalModal />
        <OrganizationSecurityAndPrivacy />
      </ComponentProviders>
    );

    userEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Enable to require and enforce two-factor authentication for all members',
      })
    );

    // Hide console.error for this test
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Confirm but has API failure
    userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(
      await screen.findByRole('checkbox', {
        name: 'Enable to require and enforce two-factor authentication for all members',
      })
    ).not.toBeChecked();
  });

  it('renders join request switch', async function () {
    const {organization, router} = initializeOrg();

    render(
      <ComponentProviders
        organization={organization}
        router={router}
        location={router.location}
      >
        <OrganizationSecurityAndPrivacy />
      </ComponentProviders>
    );

    expect(
      await screen.findByRole('checkbox', {
        name: 'Enable to allow users to request to join your organization',
      })
    ).toBeInTheDocument();
  });

  it('enables require2fa but cancels confirm modal', async function () {
    const {organization, router} = initializeOrg();

    const mock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
    });

    render(
      <ComponentProviders
        organization={organization}
        router={router}
        location={router.location}
      >
        <GlobalModal />
        <OrganizationSecurityAndPrivacy />
      </ComponentProviders>
    );

    userEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Enable to require and enforce two-factor authentication for all members',
      })
    );

    // Cancel
    userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(
      screen.getByRole('checkbox', {
        name: 'Enable to require and enforce two-factor authentication for all members',
      })
    ).not.toBeChecked();

    expect(mock).not.toHaveBeenCalled();
  });

  it('enables require2fa with confirm modal', async function () {
    const {organization, router} = initializeOrg();

    const mock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
    });

    render(
      <ComponentProviders
        organization={organization}
        router={router}
        location={router.location}
      >
        <GlobalModal />
        <OrganizationSecurityAndPrivacy />
      </ComponentProviders>
    );

    userEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Enable to require and enforce two-factor authentication for all members',
      })
    );

    userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(
      screen.getByRole('checkbox', {
        name: 'Enable to require and enforce two-factor authentication for all members',
      })
    ).toBeChecked();

    expect(mock).toHaveBeenCalledWith(
      '/organizations/org-slug/',
      expect.objectContaining({
        method: 'PUT',
        data: {
          require2FA: true,
        },
      })
    );
  });
});
