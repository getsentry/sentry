import {browserHistory} from 'react-router';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import * as useMedia from 'sentry/utils/useMedia';
import {GroupEventCarousel} from 'sentry/views/issueDetails/groupEventCarousel';

describe('GroupEventCarousel', () => {
  const testEvent = TestStubs.Event({
    id: 'event-id',
    size: 7,
    dateCreated: '2019-03-20T00:00:00.000Z',
    errors: [],
    entries: [],
    tags: [{key: 'environment', value: 'dev'}],
    previousEventID: 'prev-event-id',
    nextEventID: 'next-event-id',
  });

  const singleTestEvent = {...testEvent, previousEventID: null, nextEventID: null};

  const defaultProps = {
    event: testEvent,
    group: TestStubs.Group({id: 'group-id'}),
    projectSlug: 'project-slug',
  };

  const singleEventProps = {...defaultProps, event: singleTestEvent};

  beforeEach(() => {
    jest.restoreAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(''),
      },
    });
    window.open = jest.fn();
  });

  describe('recommended event ui', () => {
    const orgWithRecommendedEvent = TestStubs.Organization({
      features: [
        'issue-details-most-helpful-event',
        'issue-details-most-helpful-event-ui',
      ],
    });

    it('can navigate to the oldest event', async () => {
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<GroupEventCarousel {...defaultProps} />, {
        organization: orgWithRecommendedEvent,
      });

      await userEvent.click(screen.getByRole('button', {name: /recommended/i}));
      await userEvent.click(screen.getByRole('option', {name: /oldest/i}));

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/group-id/events/oldest/',
        query: {referrer: 'oldest-event'},
      });
    });

    it('can navigate to the latest event', async () => {
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<GroupEventCarousel {...defaultProps} />, {
        organization: orgWithRecommendedEvent,
      });

      await userEvent.click(screen.getByRole('button', {name: /recommended/i}));
      await userEvent.click(screen.getByRole('option', {name: /latest/i}));

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/group-id/events/latest/',
        query: {referrer: 'latest-event'},
      });
    });

    it('can navigate to the recommended event', async () => {
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<GroupEventCarousel {...defaultProps} />, {
        organization: orgWithRecommendedEvent,
        router: {
          params: {eventId: 'latest'},
        },
      });

      await userEvent.click(screen.getByRole('button', {name: /latest/i}));
      await userEvent.click(screen.getByRole('option', {name: /recommended/i}));

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/group-id/events/recommended/',
        query: {referrer: 'recommended-event'},
      });
    });

    it('will disable the dropdown if there is only one event', async () => {
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<GroupEventCarousel {...singleEventProps} />, {
        organization: orgWithRecommendedEvent,
      });

      expect(await screen.getByRole('button', {name: 'Recommended'})).toBeDisabled();
    });
  });

  it('can navigate next/previous events', () => {
    render(<GroupEventCarousel {...defaultProps} />);

    expect(screen.getByLabelText(/Previous Event/)).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/group-id/events/prev-event-id/?referrer=previous-event`
    );
    expect(screen.getByLabelText(/Next Event/)).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/group-id/events/next-event-id/?referrer=next-event`
    );
  });

  it('can copy event ID', async () => {
    render(<GroupEventCarousel {...defaultProps} />);

    await userEvent.click(screen.getByText(testEvent.id));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testEvent.id);
  });

  it('can copy event link', async () => {
    render(<GroupEventCarousel {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', {name: /event actions/i}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: /copy event link/i}));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `http://localhost/organizations/org-slug/issues/group-id/events/event-id/`
    );
  });

  it('links to full event details when org has discover', async () => {
    render(<GroupEventCarousel {...defaultProps} />, {
      organization: TestStubs.Organization({features: ['discover-basic']}),
    });

    await userEvent.click(screen.getByRole('button', {name: /event actions/i}));

    expect(
      within(screen.getByRole('menuitemradio', {name: /full event details/i})).getByRole(
        'link'
      )
    ).toHaveAttribute('href', `/organizations/org-slug/discover/project-slug:event-id/`);
  });

  it('can open event JSON', async () => {
    render(<GroupEventCarousel {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', {name: /event actions/i}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'JSON (7 B)'}));

    expect(window.open).toHaveBeenCalledWith(
      `/api/0/projects/org-slug/project-slug/events/event-id/json/`
    );
  });
});
