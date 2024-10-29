import {EventFixture} from 'sentry-fixture/event';
import {EventAttachmentFixture} from 'sentry-fixture/eventAttachment';
import {GroupFixture} from 'sentry-fixture/group';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as useMedia from 'sentry/utils/useMedia';
import {SectionKey, useEventDetails} from 'sentry/views/issueDetails/streamline/context';

import {IssueEventNavigation} from './eventNavigation';

jest.mock('sentry/views/issueDetails/streamline/context');

describe('EventNavigation', () => {
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
  const defaultProps: React.ComponentProps<typeof IssueEventNavigation> = {
    event: testEvent,
    group,
    query: undefined,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(useEventDetails).mockReturnValue({
      sectionData: {
        highlights: {key: SectionKey.HIGHLIGHTS},
        tags: {key: SectionKey.TAGS},
        replay: {key: SectionKey.REPLAY},
      },
      dispatch: jest.fn(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/attachments/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replay-count/',
      body: {},
    });
  });

  describe('recommended event tabs', () => {
    it('can navigate to the oldest event', async () => {
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<IssueEventNavigation {...defaultProps} />, {router});

      await userEvent.click(screen.getByRole('tab', {name: 'First'}));

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/group-id/events/oldest/',
        query: {referrer: 'oldest-event'},
      });
    });

    it('can navigate to the latest event', async () => {
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<IssueEventNavigation {...defaultProps} />, {router});

      await userEvent.click(screen.getByRole('tab', {name: 'Last'}));

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

      render(<IssueEventNavigation {...defaultProps} />, {
        router: recommendedEventRouter,
      });

      await userEvent.click(screen.getByRole('tab', {name: 'Rec.'}));

      expect(recommendedEventRouter.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/group-id/events/recommended/',
        query: {referrer: 'recommended-event'},
      });
    });
  });

  it('can navigate next/previous events', () => {
    render(<IssueEventNavigation {...defaultProps} />);

    expect(screen.getByLabelText(/Previous Event/)).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/group-id/events/prev-event-id/?referrer=previous-event`
    );
    expect(screen.getByLabelText(/Next Event/)).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/group-id/events/next-event-id/?referrer=next-event`
    );
  });

  describe('counts', () => {
    it('renders default counts', async () => {
      render(<IssueEventNavigation {...defaultProps} />);
      await userEvent.click(screen.getByRole('button', {name: 'Events'}));

      expect(
        await screen.findByRole('menuitemradio', {name: 'Attachments 0'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitemradio', {name: 'Events 327k'})
      ).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', {name: 'Replays 0'})).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', {name: 'Feedback 0'})).toBeInTheDocument();
    });

    it('renders 1 attachment', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/attachments/`,
        body: [EventAttachmentFixture()],
      });

      render(<IssueEventNavigation {...defaultProps} />);
      await userEvent.click(screen.getByRole('button', {name: 'Events'}));

      expect(
        await screen.findByRole('menuitemradio', {name: 'Attachments 1'})
      ).toBeInTheDocument();
    });

    it('renders 50+ attachments', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/attachments/`,
        body: [EventAttachmentFixture()],
        headers: {
          // Assumes there is more than 50 attachments if there is a next page
          Link: '<https://sentry.io>; rel="previous"; results="false"; cursor="0:0:1", <https://sentry.io>; rel="next"; results="true"; cursor="0:20:0"',
        },
      });

      render(<IssueEventNavigation {...defaultProps} />);
      await userEvent.click(screen.getByRole('button', {name: 'Events'}));

      expect(
        await screen.findByRole('menuitemradio', {name: 'Attachments 50+'})
      ).toBeInTheDocument();
    });
  });
});
