import {browserHistory} from 'react-router';
import {Config as ConfigFixture} from 'sentry-fixture/config';
import {Event as EventFixture} from 'sentry-fixture/event';
import {Group as GroupFixture} from 'sentry-fixture/group';
import {Organization} from 'sentry-fixture/organization';
import {User} from 'sentry-fixture/user';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import * as useMedia from 'sentry/utils/useMedia';
import {GroupEventCarousel} from 'sentry/views/issueDetails/groupEventCarousel';

describe('GroupEventCarousel', () => {
  const testEvent = EventFixture({
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
    group: GroupFixture({id: 'group-id'}),
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
    const recommendedUser = User({
      options: {
        ...User().options,
        defaultIssueEvent: 'recommended',
      },
    });
    const latestUser = User({
      options: {
        ...User().options,
        defaultIssueEvent: 'latest',
      },
    });
    const oldestUser = User({
      options: {
        ...User().options,
        defaultIssueEvent: 'oldest',
      },
    });

    it('can navigate to the oldest event', async () => {
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<GroupEventCarousel {...defaultProps} />);

      await userEvent.click(screen.getByRole('button', {name: /recommended/i}));
      await userEvent.click(screen.getByRole('option', {name: /oldest/i}));

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/group-id/events/oldest/',
        query: {referrer: 'oldest-event'},
      });
    });

    it('can navigate to the latest event', async () => {
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<GroupEventCarousel {...defaultProps} />);

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

      render(<GroupEventCarousel {...singleEventProps} />);

      expect(await screen.getByRole('button', {name: 'Recommended'})).toBeDisabled();
    });

    it('if user default is recommended, it will show it as default', async () => {
      ConfigStore.loadInitialData(ConfigFixture({user: recommendedUser}));
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<GroupEventCarousel {...singleEventProps} />);

      expect(await screen.getByText('Recommended')).toBeInTheDocument();
    });

    it('if user default is latest, it will show it as default', async () => {
      ConfigStore.loadInitialData(ConfigFixture({user: latestUser}));
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<GroupEventCarousel {...singleEventProps} />);

      expect(await screen.getByText('Latest')).toBeInTheDocument();
    });

    it('if user default is oldest, it will show it as default', async () => {
      ConfigStore.loadInitialData(ConfigFixture({user: oldestUser}));
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<GroupEventCarousel {...singleEventProps} />);

      expect(await screen.getByText('Oldest')).toBeInTheDocument();
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
      organization: Organization({features: ['discover-basic']}),
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
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'JSON (7.0 B)'}));

    expect(window.open).toHaveBeenCalledWith(
      `https://us.sentry.io/api/0/projects/org-slug/project-slug/events/event-id/json/`
    );
  });
});
