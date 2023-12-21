import {Event as EventFixture} from 'sentry-fixture/event';
import {Group as GroupFixture} from 'sentry-fixture/group';
import {User} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import {EventOrGroupType} from 'sentry/types';

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

describe('EventOrGroupHeader', function () {
  const {organization, router, routerContext} = initializeOrg();

  describe('Group', function () {
    it('renders with `type = error`', function () {
      render(<EventOrGroupHeader organization={organization} data={group} {...router} />);
    });

    it('renders with `type = csp`', function () {
      render(
        <EventOrGroupHeader
          organization={organization}
          data={{
            ...group,
            type: EventOrGroupType.CSP,
          }}
          {...router}
        />
      );
    });

    it('renders with `type = default`', function () {
      render(
        <EventOrGroupHeader
          organization={organization}
          data={{
            ...group,
            type: EventOrGroupType.DEFAULT,
            metadata: {
              ...group.metadata,
              title: 'metadata title',
            },
          }}
          {...router}
        />
      );
    });

    it('renders metadata values in message for error events', function () {
      render(
        <EventOrGroupHeader
          organization={organization}
          data={{
            ...group,
            type: EventOrGroupType.ERROR,
          }}
          {...router}
        />
      );

      expect(screen.getByText('metadata value')).toBeInTheDocument();
    });

    it('renders location', function () {
      render(
        <EventOrGroupHeader
          organization={organization}
          data={{
            ...group,
            metadata: {
              filename: 'path/to/file.swift',
            },
            platform: 'swift',
            type: EventOrGroupType.ERROR,
          }}
          {...router}
        />
      );

      expect(
        screen.getByText(textWithMarkupMatcher('in path/to/file.swift'))
      ).toBeInTheDocument();
    });
  });

  describe('Event', function () {
    it('renders with `type = error`', function () {
      render(
        <EventOrGroupHeader
          organization={organization}
          data={EventFixture({
            ...event,
            type: EventOrGroupType.ERROR,
          })}
          {...router}
        />
      );
    });

    it('renders with `type = csp`', function () {
      render(
        <EventOrGroupHeader
          organization={organization}
          data={{
            ...event,
            type: EventOrGroupType.CSP,
          }}
          {...router}
        />
      );
    });

    it('renders with `type = default`', function () {
      render(
        <EventOrGroupHeader
          organization={organization}
          data={{
            ...event,
            type: EventOrGroupType.DEFAULT,
            metadata: {
              ...event.metadata,
              title: 'metadata title',
            },
          }}
          {...router}
        />
      );
    });

    it('hides level tag', function () {
      render(
        <EventOrGroupHeader
          hideLevel
          organization={organization}
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

    it('keeps sort in link when query has sort', function () {
      render(
        <EventOrGroupHeader
          organization={organization}
          data={{
            ...event,
            type: EventOrGroupType.DEFAULT,
          }}
        />,
        {
          context: routerContext,
          router: {
            ...router,
            location: {
              ...router.location,
              query: {
                ...router.location.query,
                sort: 'freq',
              },
            },
          },
        }
      );

      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        '/organizations/org-slug/issues/groupID/events/eventID/?_allp=1&referrer=event-or-group-header&sort=freq'
      );
    });

    it('lack of project adds all parameter', function () {
      render(
        <EventOrGroupHeader
          organization={organization}
          data={{
            ...event,
            type: EventOrGroupType.DEFAULT,
          }}
        />,
        {
          context: routerContext,
          router: {
            ...router,
            location: {
              ...router.location,
              query: {},
            },
          },
        }
      );

      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        '/organizations/org-slug/issues/groupID/events/eventID/?_allp=1&referrer=event-or-group-header'
      );
    });
  });

  it('renders group tombstone without link to group', function () {
    render(
      <EventOrGroupHeader
        organization={organization}
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
            display_title_with_tree_label: false,
          },
          actor: User(),
          isTombstone: true,
        }}
        {...router}
      />
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
