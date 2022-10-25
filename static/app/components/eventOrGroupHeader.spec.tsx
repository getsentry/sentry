import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import {EventOrGroupType} from 'sentry/types';

const group = TestStubs.Group({
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

const event = TestStubs.Event({
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
  const {organization, router} = initializeOrg({
    router: {orgId: 'orgId'},
  } as Parameters<typeof initializeOrg>[0]);

  describe('Group', function () {
    it('renders with `type = error`', function () {
      const {container} = render(
        <EventOrGroupHeader organization={organization} data={group} {...router} />
      );

      expect(container).toSnapshot();
    });

    it('renders with `type = csp`', function () {
      const {container} = render(
        <EventOrGroupHeader
          organization={organization}
          data={{
            ...group,
            type: EventOrGroupType.CSP,
          }}
          {...router}
        />
      );

      expect(container).toSnapshot();
    });

    it('renders with `type = default`', function () {
      const {container} = render(
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

      expect(container).toSnapshot();
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
      const {container} = render(
        <EventOrGroupHeader
          organization={organization}
          data={{
            ...event,
            type: EventOrGroupType.ERROR,
          }}
          {...router}
        />
      );
      expect(container).toSnapshot();
    });

    it('renders with `type = csp`', function () {
      const {container} = render(
        <EventOrGroupHeader
          organization={organization}
          data={{
            ...event,
            type: EventOrGroupType.CSP,
          }}
          {...router}
        />
      );
      expect(container).toSnapshot();
    });

    it('renders with `type = default`', function () {
      const {container} = render(
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
      expect(container).toSnapshot();
    });

    it('hides level tag', function () {
      const {container} = render(
        <EventOrGroupHeader
          projectId="projectId"
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
          {...router}
        />
      );
      expect(container).toSnapshot();
    });

    it('keeps sort in link when query has sort', function () {
      render(
        <EventOrGroupHeader
          organization={organization}
          data={{
            ...event,
            type: EventOrGroupType.DEFAULT,
          }}
          {...router}
          location={{
            ...router.location,
            query: {
              ...router.location.query,
              sort: 'freq',
            },
          }}
        />
      );

      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        '/organizations/org-slug/issues/groupID/events/eventID/?_allp=1&referrer=event-or-group-header&sort=freq'
      );
    });

    it('lack of project adds allp parameter', function () {
      render(
        <EventOrGroupHeader
          organization={organization}
          data={{
            ...event,
            type: EventOrGroupType.DEFAULT,
          }}
          {...router}
          location={{
            ...router.location,
            query: {},
          }}
        />
      );

      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        '/organizations/org-slug/issues/groupID/events/eventID/?_allp=1&referrer=event-or-group-header'
      );
    });
  });
});
