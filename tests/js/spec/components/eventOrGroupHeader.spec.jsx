import React from 'react';
import toJson from 'enzyme-to-json';

import {shallow} from 'sentry-test/enzyme';

import EventOrGroupHeader from 'app/components/eventOrGroupHeader';

const data = {
  metadata: {
    title: 'metadata title',
    type: 'metadata type',
    directive: 'metadata directive',
    uri: 'metadata uri',
    value: 'metadata value',
    message: 'metadata message',
  },
  culprit: 'culprit',
};

describe('EventOrGroupHeader', function() {
  describe('Group', function() {
    const groupData = {
      ...data,
      level: 'error',
      id: 'id',
    };
    it('renders with `type = error`', function() {
      const component = shallow(
        <EventOrGroupHeader
          orgId="orgId"
          data={{
            ...groupData,
            ...{
              type: 'error',
            },
          }}
        />
      );

      expect(toJson(component)).toMatchSnapshot();
    });

    it('renders with `type = csp`', function() {
      const component = shallow(
        <EventOrGroupHeader
          params={{orgId: 'orgId'}}
          data={{
            ...groupData,
            ...{
              type: 'csp',
            },
          }}
        />
      );

      expect(toJson(component)).toMatchSnapshot();
    });

    it('renders with `type = default`', function() {
      const component = shallow(
        <EventOrGroupHeader
          params={{orgId: 'orgId'}}
          data={{
            ...groupData,
            ...{
              type: 'default',
            },
          }}
        />
      );

      expect(toJson(component)).toMatchSnapshot();
    });
  });

  describe('Event', function() {
    const eventData = {
      ...data,
      id: 'id',
      eventID: 'eventID',
      groupID: 'groupID',
      culprit: undefined,
    };

    it('renders with `type = error`', function() {
      const component = shallow(
        <EventOrGroupHeader
          params={{orgId: 'orgId'}}
          data={{
            ...eventData,
            ...{
              type: 'error',
            },
          }}
        />
      );

      expect(toJson(component)).toMatchSnapshot();
    });

    it('renders with `type = csp`', function() {
      const component = shallow(
        <EventOrGroupHeader
          params={{orgId: 'orgId'}}
          data={{
            ...eventData,
            ...{
              type: 'csp',
            },
          }}
        />
      );

      expect(toJson(component)).toMatchSnapshot();
    });

    it('renders with `type = default`', function() {
      const component = shallow(
        <EventOrGroupHeader
          params={{orgId: 'orgId'}}
          data={{
            ...eventData,
            ...{
              type: 'default',
            },
          }}
        />
      );

      expect(toJson(component)).toMatchSnapshot();
    });

    it('hides level tag', function() {
      const component = shallow(
        <EventOrGroupHeader
          projectId="projectId"
          hideLevel
          data={{
            ...eventData,
            ...{
              type: 'default',
            },
          }}
        />
      );

      expect(toJson(component)).toMatchSnapshot();
    });

    it('keeps sort in link when query has sort', function() {
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

      const title = component
        .dive()
        .instance()
        .getTitle();

      expect(title.props.to.query.sort).toEqual('freq');
    });

    it('lack of project adds allp parameter', function() {
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

      const title = component
        .dive()
        .instance()
        .getTitle();

      expect(title.props.to.query._allp).toEqual(1);
    });
  });
});
