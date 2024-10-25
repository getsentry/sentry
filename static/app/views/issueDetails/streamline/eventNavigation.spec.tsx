import {EventFixture} from 'sentry-fixture/event';
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
  const {router} = initializeOrg();
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
    group: GroupFixture({id: 'group-id'}),
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
});
