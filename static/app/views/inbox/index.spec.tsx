import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Inbox from 'sentry/views/inbox';

const INBOX_ROUTES = [
  '/organizations/:orgId/inbox/',
  '/organizations/:orgId/inbox/issue/:id/',
  '/organizations/:orgId/inbox/notebook/:id/',
];

describe('Inbox', () => {
  const organization = OrganizationFixture({features: ['universal-inbox']});

  it('selects an item from the list', async () => {
    const {router} = render(<Inbox />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/inbox/'},
        routes: INBOX_ROUTES,
      },
    });

    const item = await screen.findByRole('link', {
      name: /OperationalError: could not connect to server/,
    });
    expect(item).not.toHaveAttribute('aria-current');

    await userEvent.click(item);

    expect(router.location.pathname).toBe('/organizations/org-slug/inbox/notebook/203/');
    expect(item).toHaveAttribute('aria-current', 'true');
  });

  it('previews the selected item', async () => {
    render(<Inbox />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/inbox/'},
        routes: INBOX_ROUTES,
      },
    });

    expect(await screen.findByText('No item selected')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('link', {name: /OperationalError: could not connect to server/})
    );

    expect(
      screen.getByRole('heading', {name: 'OperationalError: could not connect to server'})
    ).toBeInTheDocument();
  });

  it('selects the item for the issue in the url', async () => {
    render(<Inbox />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/inbox/issue/101/'},
        routes: INBOX_ROUTES,
      },
    });

    expect(
      await screen.findByRole('heading', {
        name: "TypeError: Cannot read properties of undefined (reading 'id')",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: /TypeError: Cannot read properties/})
    ).toHaveAttribute('aria-current', 'true');
  });

  it('renders not found without the feature flag', () => {
    render(<Inbox />, {organization: OrganizationFixture()});

    expect(
      screen.queryByText('OperationalError: could not connect to server')
    ).not.toBeInTheDocument();
  });
});
