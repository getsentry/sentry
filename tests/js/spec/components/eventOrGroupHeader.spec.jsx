import React from 'react';
import {shallow} from 'enzyme';
import toJson from 'enzyme-to-json';
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
      let component = shallow(
        <EventOrGroupHeader
          orgId="orgId"
          projectId="projectId"
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
      let component = shallow(
        <EventOrGroupHeader
          orgId="orgId"
          projectId="projectId"
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
      let component = shallow(
        <EventOrGroupHeader
          orgId="orgId"
          projectId="projectId"
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
      let component = shallow(
        <EventOrGroupHeader
          orgId="orgId"
          projectId="projectId"
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
      let component = shallow(
        <EventOrGroupHeader
          orgId="orgId"
          projectId="projectId"
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
      let component = shallow(
        <EventOrGroupHeader
          orgId="orgId"
          projectId="projectId"
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
      let component = shallow(
        <EventOrGroupHeader
          orgId="orgId"
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
  });
});
