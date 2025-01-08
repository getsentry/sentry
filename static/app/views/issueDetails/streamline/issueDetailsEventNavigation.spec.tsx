import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as useMedia from 'sentry/utils/useMedia';

import {IssueDetailsEventNavigation} from './issueDetailsEventNavigation';

describe('IssueDetailsEventNavigation', () => {
  const {organization, router} = initializeOrg();
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

  beforeEach(() => {
    jest.resetAllMocks();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
      body: [],
    });
  });

  describe('recommended event tabs', () => {
    it('can navigate to the oldest event', async () => {
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<IssueDetailsEventNavigation {...defaultProps} />, {router});

      await userEvent.click(await screen.findByRole('tab', {name: 'First'}));

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/group-id/events/oldest/',
        query: {referrer: 'oldest-event'},
      });
    });

    it('can navigate to the latest event', async () => {
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<IssueDetailsEventNavigation {...defaultProps} />, {router});

      await userEvent.click(await screen.findByRole('tab', {name: 'Last'}));

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/group-id/events/latest/',
        query: {referrer: 'latest-event'},
      });
    });

    it('can navigate to the recommended event', async () => {
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      const recommendedEventRouter = RouterFixture({
        params: {eventId: 'latest'},
        location: LocationFixture({
          pathname: `/organizations/org-slug/issues/group-id/events/latest/`,
        }),
      });

      render(<IssueDetailsEventNavigation {...defaultProps} />, {
        router: recommendedEventRouter,
      });

      await userEvent.click(await screen.findByRole('tab', {name: 'Rec.'}));

      expect(recommendedEventRouter.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/group-id/events/recommended/',
        query: {referrer: 'recommended-event'},
      });
    });
  });

  it('can navigate next/previous events', async () => {
    render(<IssueDetailsEventNavigation {...defaultProps} />);

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
    render(<IssueDetailsEventNavigation {...defaultProps} event={event} />);

    expect(mockNextEvent).not.toHaveBeenCalled();
    expect(mockPreviousEvent).not.toHaveBeenCalled();

    await userEvent.hover(await screen.findByRole('button', {name: 'Next Event'}));

    await waitFor(() => expect(mockNextEvent).toHaveBeenCalled());
    expect(mockPreviousEvent).not.toHaveBeenCalled();

    await userEvent.hover(screen.getByRole('button', {name: 'Previous Event'}));
    await waitFor(() => expect(mockPreviousEvent).toHaveBeenCalled());
  });
});
