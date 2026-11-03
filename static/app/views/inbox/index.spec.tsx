import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Inbox from 'sentry/views/inbox';
import {InvestigationDetailFixture} from 'sentry/views/investigations/fixtures';

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

    expect(router.location.pathname).toBe(
      '/organizations/org-slug/inbox/notebook/1000210/'
    );
    expect(item).toHaveAttribute('aria-current', 'true');
  });

  it('previews the selected item', async () => {
    const detailUrl = '/organizations/org-slug/notebooks/1000210/';
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({
        id: '1000210',
        title: 'OperationalError: could not connect to server',
      }),
    });
    MockApiClient.addMockResponse({url: `${detailUrl}comments/`, body: []});
    MockApiClient.addMockResponse({url: `${detailUrl}comment-counts/`, body: {}});
    MockApiClient.addMockResponse({
      url: `${detailUrl}presence/`,
      method: 'PUT',
      body: {viewers: [], total: 0, heartbeatIntervalMs: 5000},
    });

    render(<Inbox />, {
      organization: OrganizationFixture({
        features: ['universal-inbox', 'investigations'],
        openMembership: true,
      }),
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/inbox/'},
        routes: INBOX_ROUTES,
      },
    });

    expect(await screen.findByText('No item selected')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('link', {name: /OperationalError: could not connect to server/})
    );

    expect(await screen.findByRole('textbox', {name: 'Investigation title'})).toHaveValue(
      'OperationalError: could not connect to server'
    );
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
    ).toHaveAttribute('href', '/organizations/org-slug/inbox/notebook/1000210/');
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

    await userEvent.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(
      screen.getByRole('checkbox', {name: 'Select Checkout latency regression'})
    ).not.toBeChecked();
    expect(router.location.pathname).toBe('/organizations/org-slug/inbox/');

    await userEvent.click(checkbox);

    expect(checkbox).not.toBeChecked();
  });

  it('renders not found without the feature flag', () => {
    render(<Inbox />, {organization: OrganizationFixture()});

    expect(
      screen.queryByText('OperationalError: could not connect to server')
    ).not.toBeInTheDocument();
  });
});
