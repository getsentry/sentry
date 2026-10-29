import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Inbox from 'sentry/views/inbox';

describe('Inbox', () => {
  const organization = OrganizationFixture({features: ['universal-inbox']});

  it('selects an item from the list', async () => {
    const {router} = render(<Inbox />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/inbox/'},
        route: '/organizations/:orgId/inbox/:id?/',
      },
    });

    const item = await screen.findByRole('link', {
      name: /OperationalError: could not connect to server/,
    });
    expect(item).not.toHaveAttribute('aria-current');

    await userEvent.click(item);

    expect(router.location.pathname).toBe('/organizations/org-slug/inbox/2/');
    expect(item).toHaveAttribute('aria-current', 'true');
  });

  it('renders not found without the feature flag', () => {
    render(<Inbox />, {organization: OrganizationFixture()});

    expect(
      screen.queryByText('OperationalError: could not connect to server')
    ).not.toBeInTheDocument();
  });
});
