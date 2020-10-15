import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, shallow} from 'sentry-test/enzyme';

import EventOrGroupHeader from 'app/components/eventOrGroupHeader';

const data = {
  metadata: {
    type: 'metadata type',
    directive: 'metadata directive',
    uri: 'metadata uri',
    value: 'metadata value',
    message: 'metadata message',
  },
  culprit: 'culprit',
};

describe('EventOrGroupHeader', function () {
  const {routerContext} = initializeOrg();
  describe('Group', function () {
    const groupData = {
      ...data,
      level: 'error',
      id: 'id',
    };
    it('renders with `type = error`', function () {
      const component = mountWithTheme(
        <EventOrGroupHeader
          orgId="orgId"
          data={{
            ...groupData,
            ...{
              type: 'error',
            },
          }}
        />,
        routerContext
      );

      expect(component).toSnapshot();
    });

    it('renders with `type = csp`', function () {
      const component = mountWithTheme(
        <EventOrGroupHeader
          params={{orgId: 'orgId'}}
          data={{
            ...groupData,
            ...{
              type: 'csp',
            },
          }}
        />,
        routerContext
      );

      expect(component).toSnapshot();
    });

    it('renders with `type = default`', function () {
      const component = mountWithTheme(
        <EventOrGroupHeader
          params={{orgId: 'orgId'}}
          data={{
            ...groupData,
            ...{
              type: 'default',
            },
          }}
        />,
        routerContext
      );

      expect(component).toSnapshot();
    });
  });

  describe('Event', function () {
    const eventData = {
      ...data,
      id: 'id',
      eventID: 'eventID',
      groupID: 'groupID',
      culprit: undefined,
    };

    it('renders with `type = error`', function () {
      const component = mountWithTheme(
        <EventOrGroupHeader
          params={{orgId: 'orgId'}}
          data={{
            ...eventData,
            ...{
              type: 'error',
            },
          }}
        />,
        routerContext
      );

      expect(component).toSnapshot();
    });

    it('renders with `type = csp`', function () {
      const component = mountWithTheme(
        <EventOrGroupHeader
          params={{orgId: 'orgId'}}
          data={{
            ...eventData,
            ...{
              type: 'csp',
            },
          }}
        />,
        routerContext
      );

      expect(component).toSnapshot();
    });

    it('renders with `type = default`', function () {
      const component = mountWithTheme(
        <EventOrGroupHeader
          params={{orgId: 'orgId'}}
          data={{
            ...eventData,
            ...{
              type: 'default',
            },
          }}
        />,
        routerContext
      );

      expect(component).toSnapshot();
    });

    it('hides level tag', function () {
      const component = mountWithTheme(
        <EventOrGroupHeader
          projectId="projectId"
          hideLevel
          data={{
            ...eventData,
            ...{
              type: 'default',
            },
          }}
        />,
        routerContext
      );

      expect(component).toSnapshot();
    });

    it('keeps sort in link when query has sort', function () {
      const query = {
        sort: 'freq',
      };

      const component = shallow(
        <EventOrGroupHeader
          params={{orgId: 'orgId'}}
          data={{
            ...eventData,
            ...{
              type: 'default',
            },
          }}
          location={{query}}
        />
      );

      const title = component.dive().instance().getTitle();

      expect(title.props.to.query.sort).toEqual('freq');
    });

    it('lack of project adds allp parameter', function () {
      const query = {};

      const component = shallow(
        <EventOrGroupHeader
          params={{orgId: 'orgId'}}
          data={{
            ...eventData,
            ...{
              type: 'default',
            },
          }}
          location={{query}}
        />
      );

      const title = component.dive().instance().getTitle();

      expect(title.props.to.query._allp).toEqual(1);
    });
  });
});
