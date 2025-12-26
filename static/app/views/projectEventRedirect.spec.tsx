import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectEventRedirect from 'sentry/views/projectEventRedirect';

describe('ProjectEventRedirect', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('redirects to issue event page when event has groupID', async () => {
    const event = EventFixture({
      eventID: 'abc123',
      groupID: '456',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/my-project:event-id/`,
      body: event,
    });

    const {router} = render(<ProjectEventRedirect />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/projects/my-project/events/event-id/`,
        },
        route: '/organizations/:orgId/projects/:projectId/events/:eventId/',
      },
    });

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: `/organizations/${organization.slug}/issues/456/events/abc123/`,
        })
      );
    });
  });

  it('redirects to trace details for transaction events without groupID', async () => {
    const event = EventFixture({
      eventID: 'abc123',
      groupID: undefined,
      contexts: {
        trace: {
          trace_id: 'trace-123',
        },
      },
      dateCreated: '2024-01-01T00:00:00.000Z',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/my-project:event-id/`,
      body: event,
    });

    const {router} = render(<ProjectEventRedirect />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/projects/my-project/events/event-id/`,
        },
        route: '/organizations/:orgId/projects/:projectId/events/:eventId/',
      },
    });

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: expect.stringContaining('/trace/trace-123/'),
        })
      );
    });
  });

  it('shows NotFound for 404 errors', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/my-project:event-id/`,
      statusCode: 404,
      body: {detail: 'Event not found'},
    });

    render(<ProjectEventRedirect />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/projects/my-project/events/event-id/`,
        },
        route: '/organizations/:orgId/projects/:projectId/events/:eventId/',
      },
    });

    expect(
      await screen.findByText(/page you are looking for was not found/i)
    ).toBeInTheDocument();
  });

  it('shows permission error for 403 errors', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/my-project:event-id/`,
      statusCode: 403,
      body: {detail: 'Permission denied'},
    });

    render(<ProjectEventRedirect />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/projects/my-project/events/event-id/`,
        },
        route: '/organizations/:orgId/projects/:projectId/events/:eventId/',
      },
    });

    expect(
      await screen.findByText(/you do not have permission to view that event/i)
    ).toBeInTheDocument();
  });

  it('shows loading indicator while fetching event', () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/my-project:event-id/`,
      body: EventFixture(),
    });

    render(<ProjectEventRedirect />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/projects/my-project/events/event-id/`,
        },
        route: '/organizations/:orgId/projects/:projectId/events/:eventId/',
      },
    });

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('preserves query parameters during redirect', async () => {
    const event = EventFixture({
      eventID: 'abc123',
      groupID: '456',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/my-project:event-id/`,
      body: event,
    });

    const {router} = render(<ProjectEventRedirect />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/projects/my-project/events/event-id/`,
          query: {referrer: 'discover-events-table'},
        },
        route: '/organizations/:orgId/projects/:projectId/events/:eventId/',
      },
    });

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: `/organizations/${organization.slug}/issues/456/events/abc123/`,
          query: {referrer: 'discover-events-table'},
        })
      );
    });
  });
});
