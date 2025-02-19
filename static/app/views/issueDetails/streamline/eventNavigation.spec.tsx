import {EventFixture} from 'sentry-fixture/event';
import {EventAttachmentFixture} from 'sentry-fixture/eventAttachment';
import {GroupFixture} from 'sentry-fixture/group';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SectionKey, useIssueDetails} from 'sentry/views/issueDetails/streamline/context';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';

import {IssueEventNavigation} from './eventNavigation';

jest.mock('sentry/views/issueDetails/streamline/context');

describe('EventNavigation', () => {
  const {organization} = initializeOrg();
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
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(useIssueDetails).mockReturnValue({
      sectionData: {
        highlights: {key: SectionKey.HIGHLIGHTS},
        tags: {key: SectionKey.TAGS},
        replay: {key: SectionKey.REPLAY},
      },
      detectorDetails: {},
      eventCount: 0,
      isSidebarOpen: true,
      navScrollMargin: 0,
      dispatch: jest.fn(),
      activeSection: null,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
      body: [],
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

  describe('all events buttons', () => {
    it('renders the all events controls', () => {
      const allEventsRouter = RouterFixture({
        params: {groupId: group.id},
        routes: [{path: TabPaths[Tab.EVENTS]}],
        location: LocationFixture({
          pathname: `/organizations/${organization.slug}/issues/${group.id}/events/`,
        }),
      });

      render(<IssueEventNavigation {...defaultProps} />, {router: allEventsRouter});

      const discoverButton = screen.getByLabelText('Open in Discover');
      expect(discoverButton).toBeInTheDocument();
      expect(discoverButton).toHaveAttribute(
        'href',
        expect.stringContaining(`/organizations/${organization.slug}/discover/results/`)
      );

      const closeButton = screen.getByRole('button', {name: 'Return to event details'});
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute(
        'href',
        expect.stringContaining(`/organizations/${organization.slug}/issues/${group.id}/`)
      );
    });
  });

  describe('counts', () => {
    it('renders default counts', async () => {
      render(<IssueEventNavigation {...defaultProps} />);
      await userEvent.click(screen.getByRole('button', {name: 'Select issue content'}));

      expect(
        await screen.findByRole('menuitemradio', {name: 'Attachments 0'})
      ).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', {name: 'Events 0'})).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', {name: 'Replays 0'})).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', {name: 'Feedback 0'})).toBeInTheDocument();
    });

    it('renders 1 attachment', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/attachments/`,
        body: [EventAttachmentFixture()],
      });

      render(<IssueEventNavigation {...defaultProps} />);
      await userEvent.click(screen.getByRole('button', {name: 'Select issue content'}));

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
      await userEvent.click(screen.getByRole('button', {name: 'Select issue content'}));

      expect(
        await screen.findByRole('menuitemradio', {name: 'Attachments 50+'})
      ).toBeInTheDocument();
    });
  });
});
