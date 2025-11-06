import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {IssueDetailsEventNavigation} from './issueDetailsEventNavigation';

describe('IssueDetailsEventNavigation', () => {
  const group = GroupFixture({id: 'group-id'});
  const testEvent = EventFixture({
    id: 'event-id',
    size: 7,
    dateCreated: '2019-03-20T00:00:00.000Z',
    errors: [],
    entries: [],
    tags: [
      {key: 'environment', value: 'dev'},
      {key: 'replayId', value: 'replay-id'},
    ],
    previousEventID: 'prev-event-id',
    nextEventID: 'next-event-id',
  });
  const defaultProps: React.ComponentProps<typeof IssueDetailsEventNavigation> = {
    event: testEvent,
    group,
  };

  const initialRouterConfig = {
    location: {
      pathname: `/organizations/org-slug/issues/${group.id}/events/event-id/`,
    },
    route: '/organizations/:orgId/issues/:groupId/events/:eventId/',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/tags/`,
      body: [],
    });
  });

  describe('recommended event tabs', () => {
    it('can navigate to the oldest event', async () => {
      const {router} = render(
        <IssueDetailsEventNavigation {...defaultProps} isSmallNav />,
        {
          initialRouterConfig,
        }
      );

      await userEvent.click(await screen.findByRole('tab', {name: 'First'}));

      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: '/organizations/org-slug/issues/group-id/events/oldest/',
          query: {referrer: 'oldest-event'},
        })
      );
    });

    it('can navigate to the latest event', async () => {
      const {router} = render(
        <IssueDetailsEventNavigation {...defaultProps} isSmallNav />,
        {
          initialRouterConfig,
        }
      );

      await userEvent.click(await screen.findByRole('tab', {name: 'Latest'}));

      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: '/organizations/org-slug/issues/group-id/events/latest/',
          query: {referrer: 'latest-event'},
        })
      );
    });

    it('can navigate to the recommended event', async () => {
      const recommendedEventRouterConfig = {
        location: {
          pathname: `/organizations/org-slug/issues/${group.id}/events/latest/`,
        },
        route: '/organizations/:orgId/issues/:groupId/events/:eventId/',
      };

      const {router} = render(
        <IssueDetailsEventNavigation {...defaultProps} isSmallNav />,
        {
          initialRouterConfig: recommendedEventRouterConfig,
        }
      );

      await userEvent.click(await screen.findByRole('tab', {name: 'Rec.'}));

      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: '/organizations/org-slug/issues/group-id/events/recommended/',
          query: {referrer: 'recommended-event'},
        })
      );
    });
  });

  it('can navigate next/previous events', async () => {
    render(<IssueDetailsEventNavigation {...defaultProps} />, {
      initialRouterConfig,
    });

    expect(await screen.findByRole('button', {name: 'Previous Event'})).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/group-id/events/prev-event-id/?referrer=previous-event`
    );
    expect(screen.getByRole('button', {name: 'Next Event'})).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/group-id/events/next-event-id/?referrer=next-event`
    );
  });

  it('can preload next/previous events', async () => {
    const event = EventFixture({
      nextEventID: 'next-event-id',
      previousEventID: 'prev-event-id',
    });
    const mockNextEvent = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/group-id/events/next-event-id/`,
      body: EventFixture(),
    });
    const mockPreviousEvent = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/group-id/events/prev-event-id/`,
      body: EventFixture(),
    });
    render(<IssueDetailsEventNavigation {...defaultProps} event={event} />, {
      initialRouterConfig,
    });

    expect(mockNextEvent).not.toHaveBeenCalled();
    expect(mockPreviousEvent).not.toHaveBeenCalled();

    await userEvent.hover(await screen.findByRole('button', {name: 'Next Event'}));

    await waitFor(() => expect(mockNextEvent).toHaveBeenCalled());
    expect(mockPreviousEvent).not.toHaveBeenCalled();

    await userEvent.hover(screen.getByRole('button', {name: 'Previous Event'}));
    await waitFor(() => expect(mockPreviousEvent).toHaveBeenCalled());
  });
});
