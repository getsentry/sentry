import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import {EventOrGroupType} from 'sentry/types/event';

const organization = OrganizationFixture();

const group = GroupFixture({
  level: 'error',
  metadata: {
    type: 'metadata type',
    directive: 'metadata directive',
    uri: 'metadata uri',
    value: 'metadata value',
    message: 'metadata message',
  },
  culprit: 'culprit',
});

const event = EventFixture({
  id: 'id',
  eventID: 'eventID',
  groupID: 'groupID',
  culprit: undefined,
  metadata: {
    type: 'metadata type',
    directive: 'metadata directive',
    uri: 'metadata uri',
    value: 'metadata value',
    message: 'metadata message',
  },
});

const baseIssuesPath = `/organizations/${organization.slug}/issues/`;

describe('EventOrGroupHeader', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  describe('Group', () => {
    it('renders with `type = error`', () => {
      render(<EventOrGroupHeader data={group} />);
    });

    it('renders with `type = csp`', () => {
      render(
        <EventOrGroupHeader
          data={{
            ...group,
            type: EventOrGroupType.CSP,
          }}
        />
      );
    });

    it('renders with `type = default`', () => {
      render(
        <EventOrGroupHeader
          data={{
            ...group,
            type: EventOrGroupType.DEFAULT,
            metadata: {
              ...group.metadata,
              title: 'metadata title',
            },
          }}
        />
      );
    });

    it('renders metadata values in message for error events', () => {
      render(
        <EventOrGroupHeader
          data={{
            ...group,
            type: EventOrGroupType.ERROR,
          }}
        />
      );

      expect(screen.getByText('metadata value')).toBeInTheDocument();
    });

    it('preloads group on hover', async () => {
      jest.useFakeTimers();
      const mockFetchGroup = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/`,
        body: group,
      });

      render(<EventOrGroupHeader data={group} />);

      const groupLink = screen.getByRole('link');

      // Should not be called right away
      await userEvent.hover(groupLink, {delay: null});
      expect(mockFetchGroup).not.toHaveBeenCalled();

      // Called after 300ms
      jest.advanceTimersByTime(301);
      expect(mockFetchGroup).toHaveBeenCalled();
    });
  });

  describe('Event', () => {
    it('renders with `type = error`', () => {
      render(
        <EventOrGroupHeader
          data={EventFixture({
            ...event,
            type: EventOrGroupType.ERROR,
          })}
        />
      );
    });

    it('renders with `type = csp`', () => {
      render(
        <EventOrGroupHeader
          data={{
            ...event,
            type: EventOrGroupType.CSP,
          }}
        />
      );
    });

    it('renders with `type = default`', () => {
      render(
        <EventOrGroupHeader
          data={{
            ...event,
            type: EventOrGroupType.DEFAULT,
            metadata: {
              ...event.metadata,
              title: 'metadata title',
            },
          }}
        />
      );
    });

    it('hides level tag', () => {
      render(
        <EventOrGroupHeader
          hideLevel
          data={{
            ...event,
            type: EventOrGroupType.DEFAULT,
            metadata: {
              ...event.metadata,
              title: 'metadata title',
            },
          }}
        />
      );
    });

    it('keeps sort in link when query has sort', () => {
      const eventWithSort = EventFixture({
        ...event,
        type: EventOrGroupType.DEFAULT,
      });

      render(<EventOrGroupHeader data={eventWithSort} />, {
        initialRouterConfig: {
          location: {
            pathname: baseIssuesPath,
            query: {sort: 'freq'},
          },
        },
      });

      const href = screen.getByRole('link').getAttribute('href');
      expect(href).toBeTruthy();

      const url = new URL(`https://example${href}`);
      expect(url.pathname).toBe(
        `${baseIssuesPath}${eventWithSort.groupID}/events/${eventWithSort.eventID}/`
      );
      expect(url.searchParams.get('sort')).toBe('freq');
      expect(url.searchParams.get('_allp')).toBe('1');
      expect(url.searchParams.get('referrer')).toBe('event-or-group-header');
    });

    it('lack of project adds all parameter', () => {
      const eventDefault = EventFixture({
        ...event,
        type: EventOrGroupType.DEFAULT,
      });

      render(<EventOrGroupHeader data={eventDefault} />);

      const href = screen.getByRole('link').getAttribute('href');
      expect(href).toBeTruthy();

      const url = new URL(`https://example${href}`);
      expect(url.pathname).toBe(
        `${baseIssuesPath}${eventDefault.groupID}/events/${eventDefault.eventID}/`
      );
      expect(url.searchParams.get('_allp')).toBe('1');
      expect(url.searchParams.has('project')).toBe(false);
      expect(url.searchParams.get('referrer')).toBe('event-or-group-header');
    });
  });

  it('renders group tombstone without link to group', () => {
    render(
      <EventOrGroupHeader
        data={{
          id: '123',
          level: 'error',
          message: 'numTabItems is not defined ReferenceError something',
          culprit:
            'useOverflowTabs(webpack-internal:///./app/components/tabs/tabList.tsx)',
          type: EventOrGroupType.ERROR,
          metadata: {
            value: 'numTabItems is not defined',
            type: 'ReferenceError',
            filename: 'webpack-internal:///./app/components/tabs/tabList.tsx',
            function: 'useOverflowTabs',
          },
          actor: UserFixture(),
          isTombstone: true,
          dateAdded: '2025-06-25T00:00:00Z',
        }}
      />
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
