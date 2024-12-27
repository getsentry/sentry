import {ConfigFixture} from 'sentry-fixture/config';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import * as useMedia from 'sentry/utils/useMedia';
import {GroupEventCarousel} from 'sentry/views/issueDetails/groupEventCarousel';

describe('GroupEventCarousel', () => {
  const router = RouterFixture();

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
    const recommendedUser = UserFixture({
      options: {
        ...UserFixture().options,
        defaultIssueEvent: 'recommended',
      },
    });
    const latestUser = UserFixture({
      options: {
        ...UserFixture().options,
        defaultIssueEvent: 'latest',
      },
    });
    const oldestUser = UserFixture({
      options: {
        ...UserFixture().options,
        defaultIssueEvent: 'oldest',
      },
    });

    it('can navigate to the oldest event', async () => {
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<GroupEventCarousel {...defaultProps} />, {router});

      await userEvent.click(screen.getByRole('button', {name: /recommended/i}));
      await userEvent.click(screen.getByRole('option', {name: /oldest/i}));

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/group-id/events/oldest/',
        query: {referrer: 'oldest-event'},
      });
    });

    it('can navigate to the latest event', async () => {
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<GroupEventCarousel {...defaultProps} />, {router});

      await userEvent.click(screen.getByRole('button', {name: /recommended/i}));
      await userEvent.click(screen.getByRole('option', {name: /latest/i}));

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/group-id/events/latest/',
        query: {referrer: 'latest-event'},
      });
    });

    it('can navigate to the recommended event', async () => {
      const newRouter = RouterFixture({params: {eventId: 'latest'}});
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<GroupEventCarousel {...defaultProps} />, {router: newRouter});

      await userEvent.click(screen.getByRole('button', {name: /latest/i}));
      await userEvent.click(screen.getByRole('option', {name: /recommended/i}));

      expect(newRouter.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/group-id/events/recommended/',
        query: {referrer: 'recommended-event'},
      });
    });

    it('will disable the dropdown if there is only one event', async () => {
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<GroupEventCarousel {...singleEventProps} />);

      expect(await screen.findByRole('button', {name: 'Recommended'})).toBeDisabled();
    });

    it('if user default is recommended, it will show it as default', async () => {
      ConfigStore.loadInitialData(ConfigFixture({user: recommendedUser}));
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<GroupEventCarousel {...singleEventProps} />);

      expect(
        await screen.findByRole('button', {name: 'Recommended'})
      ).toBeInTheDocument();
    });

    it('if user default is latest, it will show it as default', async () => {
      ConfigStore.loadInitialData(ConfigFixture({user: latestUser}));
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<GroupEventCarousel {...singleEventProps} />);

      expect(await screen.findByRole('button', {name: 'Latest'})).toBeInTheDocument();
    });

    it('if user default is oldest, it will show it as default', async () => {
      ConfigStore.loadInitialData(ConfigFixture({user: oldestUser}));
      jest.spyOn(useMedia, 'default').mockReturnValue(true);

      render(<GroupEventCarousel {...singleEventProps} />);

      expect(await screen.findByRole('button', {name: 'Oldest'})).toBeInTheDocument();
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
      organization: OrganizationFixture({features: ['discover-basic']}),
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
