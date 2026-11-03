import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
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

  it('does not carry query params between items', async () => {
    render(<Inbox />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/inbox/',
          query: {project: '1', environment: 'production'},
        },
        routes: INBOX_ROUTES,
      },
    });

    expect(
      await screen.findByRole('link', {
        name: /OperationalError: could not connect to server/,
      })
    ).toHaveAttribute('href', '/organizations/org-slug/inbox/notebook/203/');
  });

  it('selects the item for the issue in the url', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/7656018581/',
      body: GroupFixture({id: '7656018581', metadata: {type: 'TypeError'}}),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/7656018581/events/recommended/',
      body: EventFixture({id: 'event-id'}),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/events/event-id/owners/',
      body: {owners: [], rules: []},
    });

    render(<Inbox />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/inbox/issue/7656018581/'},
        routes: INBOX_ROUTES,
      },
    });

    expect(await screen.findByRole('heading', {name: 'TypeError'})).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: /TypeError: Cannot read properties/})
    ).toHaveAttribute('aria-current', 'true');
  });

  it('selects items with checkboxes without opening them', async () => {
    const {router} = render(<Inbox />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/inbox/'},
        routes: INBOX_ROUTES,
      },
    });

    const checkbox = await screen.findByRole('checkbox', {
      name: 'Select OperationalError: could not connect to server',
    });
    expect(checkbox).not.toBeChecked();
    expect(
      screen.queryByRole('button', {name: 'Remove from inbox'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Mark as read'})).not.toBeInTheDocument();

    await userEvent.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(
      screen.getByRole('checkbox', {name: 'Select all inbox items'})
    ).toBePartiallyChecked();
    expect(screen.getByRole('button', {name: 'Remove from inbox'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Mark as read'})).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {name: 'Select Checkout latency regression'})
    ).not.toBeChecked();
    expect(router.location.pathname).toBe('/organizations/org-slug/inbox/');

    await userEvent.click(checkbox);

    expect(checkbox).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', {name: 'Select all inbox items'})
    ).not.toBePartiallyChecked();
    expect(
      screen.queryByRole('button', {name: 'Remove from inbox'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Mark as read'})).not.toBeInTheDocument();
  });

  it('selects all items from a partial selection and clears all selections', async () => {
    const {router} = render(<Inbox />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/inbox/'},
        routes: INBOX_ROUTES,
      },
    });

    const selectAll = await screen.findByRole('checkbox', {
      name: 'Select all inbox items',
    });
    const itemCheckbox = screen.getByRole('checkbox', {
      name: 'Select OperationalError: could not connect to server',
    });

    await userEvent.click(itemCheckbox);
    expect(selectAll).toBePartiallyChecked();

    await userEvent.click(selectAll);

    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox).toBeChecked();
    }
    expect(router.location.pathname).toBe('/organizations/org-slug/inbox/');

    await userEvent.click(itemCheckbox);

    expect(itemCheckbox).not.toBeChecked();
    expect(selectAll).toBePartiallyChecked();
    expect(
      screen.getByRole('checkbox', {name: 'Select Checkout latency regression'})
    ).toBeChecked();

    await userEvent.click(selectAll);
    await userEvent.click(selectAll);

    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox).not.toBeChecked();
    }
    expect(
      screen.queryByRole('button', {name: 'Remove from inbox'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Mark as read'})).not.toBeInTheDocument();
  });

  it('renders not found without the feature flag', () => {
    render(<Inbox />, {organization: OrganizationFixture()});

    expect(
      screen.queryByText('OperationalError: could not connect to server')
    ).not.toBeInTheDocument();
  });
});
