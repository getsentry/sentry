import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useGroupEvent} from './useGroupEvent';

describe('useGroupEvent', () => {
  const organization = OrganizationFixture();
  const group = GroupFixture({id: 'group-id'});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('includes statsPeriod in API request for specific event IDs', async () => {
    const mockEventRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/events/abc123/`,
      body: EventFixture(),
    });

    renderHookWithProviders(useGroupEvent, {
      initialProps: {
        groupId: group.id,
        eventId: 'abc123',
      },
      initialRouterConfig: {
        route: '/organizations/:orgId/issues/:groupId/events/:eventId/',
        location: {
          pathname: `/organizations/${organization.slug}/issues/${group.id}/events/abc123/`,
          query: {statsPeriod: '1h'},
        },
      },
    });

    await waitFor(() => expect(mockEventRequest).toHaveBeenCalled());
    expect(mockEventRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({statsPeriod: '1h'}),
      })
    );
  });

  it('includes statsPeriod in API request for reserved event IDs', async () => {
    const mockEventRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/events/latest/`,
      body: EventFixture(),
    });

    renderHookWithProviders(useGroupEvent, {
      initialProps: {
        groupId: group.id,
        eventId: 'latest',
      },
      initialRouterConfig: {
        route: '/organizations/:orgId/issues/:groupId/events/:eventId/',
        location: {
          pathname: `/organizations/${organization.slug}/issues/${group.id}/events/latest/`,
          query: {statsPeriod: '1h'},
        },
      },
    });

    await waitFor(() => expect(mockEventRequest).toHaveBeenCalled());
    expect(mockEventRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({statsPeriod: '1h'}),
      })
    );
  });

  it('uses statsPeriod from URL, not from PageFiltersStore', async () => {
    const mockEventRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/events/abc123/`,
      body: EventFixture(),
    });

    renderHookWithProviders(useGroupEvent, {
      initialProps: {
        groupId: group.id,
        eventId: 'abc123',
      },
      initialRouterConfig: {
        route: '/organizations/:orgId/issues/:groupId/events/:eventId/',
        location: {
          pathname: `/organizations/${organization.slug}/issues/${group.id}/events/abc123/`,
          query: {statsPeriod: '1h'},
        },
      },
    });

    await waitFor(() => expect(mockEventRequest).toHaveBeenCalled());
    expect(mockEventRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({statsPeriod: '1h'}),
      })
    );
    expect(mockEventRequest).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({statsPeriod: '14d'}),
      })
    );
  });

  it('does not include statsPeriod when not set in URL', async () => {
    const mockEventRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/events/abc123/`,
      body: EventFixture(),
    });

    renderHookWithProviders(useGroupEvent, {
      initialProps: {
        groupId: group.id,
        eventId: 'abc123',
      },
      initialRouterConfig: {
        route: '/organizations/:orgId/issues/:groupId/events/:eventId/',
        location: {
          pathname: `/organizations/${organization.slug}/issues/${group.id}/events/abc123/`,
        },
      },
    });

    await waitFor(() => expect(mockEventRequest).toHaveBeenCalled());
    expect(mockEventRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.not.objectContaining({statsPeriod: expect.anything()}),
      })
    );
  });
});
