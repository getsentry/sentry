import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {browserHistory} from 'sentry/utils/browserHistory';
import * as useMedia from 'sentry/utils/useMedia';
import {SectionKey, useEventDetails} from 'sentry/views/issueDetails/streamline/context';
import {EventNavigation} from 'sentry/views/issueDetails/streamline/eventNavigation';

jest.mock('sentry/views/issueDetails/streamline/context');

describe('EventNavigation', () => {
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
  const defaultProps = {
    event: testEvent,
    group: GroupFixture({id: 'group-id'}),
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
    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockResolvedValue('')},
    });
    window.open = jest.fn();

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/events/event-id/actionable-items/`,
      body: {
        errors: [],
      },
      method: 'GET',
    });
  });

  describe('recommended event tabs', () => {
    it('can navigate to the oldest event', async () => {
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<EventNavigation {...defaultProps} />);

      await userEvent.click(screen.getByRole('tab', {name: 'First'}));

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/group-id/events/oldest/',
        query: {referrer: 'oldest-event'},
      });
    });

    it('can navigate to the latest event', async () => {
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<EventNavigation {...defaultProps} />);

      await userEvent.click(screen.getByRole('tab', {name: 'Last'}));

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/group-id/events/latest/',
        query: {referrer: 'latest-event'},
      });
    });

    it('can navigate to the recommended event', async () => {
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<EventNavigation {...defaultProps} />, {
        router: {
          params: {eventId: 'latest'},
        },
      });

      await userEvent.click(screen.getByRole('tab', {name: 'Recommended'}));

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/group-id/events/recommended/',
        query: {referrer: 'recommended-event'},
      });
    });
  });

  it('can navigate next/previous events', () => {
    render(<EventNavigation {...defaultProps} />);

    expect(screen.getByLabelText(/Previous Event/)).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/group-id/events/prev-event-id/?referrer=previous-event`
    );
    expect(screen.getByLabelText(/Next Event/)).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/group-id/events/next-event-id/?referrer=next-event`
    );
  });

  it('does not show jump to sections by default', () => {
    jest.mocked(useEventDetails).mockReturnValue({
      sectionData: {},
      dispatch: jest.fn(),
    });
    render(<EventNavigation {...defaultProps} />);
    expect(screen.queryByText('Jump To:')).not.toBeInTheDocument();
    expect(screen.queryByText('Replay')).not.toBeInTheDocument();
    expect(screen.queryByText('Tags')).not.toBeInTheDocument();
    expect(screen.queryByText('Event Highlights')).not.toBeInTheDocument();
  });

  it('does show jump to sections when the sections render', () => {
    render(<EventNavigation {...defaultProps} />);
    expect(screen.getByText('Jump to:')).toBeInTheDocument();
    expect(screen.getByText('Event Highlights')).toBeInTheDocument();
    expect(screen.getByText('Replay')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
  });

  it('can copy event ID', async () => {
    render(<EventNavigation {...defaultProps} />);

    await userEvent.click(screen.getByText(testEvent.id));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testEvent.id);
  });

  it('shows event actions dropdown', async () => {
    render(<EventNavigation {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', {name: 'Event actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Copy Event ID'}));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testEvent.id);

    await userEvent.click(screen.getByRole('button', {name: 'Event actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Copy Event Link'}));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `http://localhost/organizations/org-slug/issues/group-id/events/event-id/`
    );

    await userEvent.click(screen.getByRole('button', {name: 'Event actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'View JSON'}));

    expect(window.open).toHaveBeenCalledWith(
      `https://us.sentry.io/api/0/projects/org-slug/project-slug/events/event-id/json/`
    );
  });

  it('shows processing issue button if there is an event error', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/events/event-id/actionable-items/`,
      body: {
        errors: [
          {
            type: 'invalid_data',
            data: {
              name: 'logentry',
            },
            message: 'no message present',
          },
        ],
      },
      method: 'GET',
    });
    render(<EventNavigation {...defaultProps} />);

    expect(
      await screen.findByRole('button', {name: 'Processing Error'})
    ).toBeInTheDocument();
  });
});
