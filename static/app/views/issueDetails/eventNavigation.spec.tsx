import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {browserHistory} from 'sentry/utils/browserHistory';
import * as useMedia from 'sentry/utils/useMedia';
import EventNavigation from 'sentry/views/issueDetails/eventNavigation';

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
    projectSlug: 'project-slug',
  };

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockResolvedValue('')},
    });
    window.open = jest.fn();
  });

  describe('recommended event tabs', () => {
    it('can navigate to the oldest event', async () => {
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<EventNavigation {...defaultProps} />);

      await userEvent.click(screen.getByRole('tab', {name: 'First Event'}));

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/group-id/events/oldest/',
        query: {referrer: 'oldest-event'},
      });
    });

    it('can navigate to the latest event', async () => {
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<EventNavigation {...defaultProps} />);

      await userEvent.click(screen.getByRole('tab', {name: 'Last Event'}));

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

      await userEvent.click(screen.getByRole('tab', {name: 'Recommended Event'}));

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

  it('shows jump to sections', async () => {
    render(<EventNavigation {...defaultProps} />);

    expect(await screen.findByText('Replay')).toBeInTheDocument();
    expect(await screen.findByText('Tags')).toBeInTheDocument();
    expect(await screen.findByText('Event Highlights')).toBeInTheDocument();
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
});
