import React from 'react';
import {shallow} from 'enzyme';
import toJson from 'enzyme-to-json';
import EventOrGroupExtraDetails from 'app/components/eventOrGroupExtraDetails';

jest.mock('app/mixins/projectState', () => {
  return {
    getFeatures: () => new Set(['callsigns']),
  };
});

describe('EventOrGroupExtraDetails', function() {
  it('renders last and first seen', function() {
    let component = shallow(
      <EventOrGroupExtraDetails
        orgId="orgId"
        projectId="projectId"
        groupId="groupId"
        lastSeen="2017-07-25T22:56:12Z"
        firstSeen="2017-07-01T02:06:02Z"
      />
    );

    expect(toJson(component)).toMatchSnapshot();
  });

  it('renders only first seen', function() {
    let component = shallow(
      <EventOrGroupExtraDetails
        orgId="orgId"
        projectId="projectId"
        groupId="groupId"
        firstSeen="2017-07-01T02:06:02Z"
      />
    );

    expect(toJson(component)).toMatchSnapshot();
  });

  it('renders only last seen', function() {
    let component = shallow(
      <EventOrGroupExtraDetails
        orgId="orgId"
        projectId="projectId"
        groupId="groupId"
        lastSeen="2017-07-25T22:56:12Z"
      />
    );

    expect(toJson(component)).toMatchSnapshot();
  });

  it('renders all details', function() {
    let component = shallow(
      <EventOrGroupExtraDetails
        orgId="orgId"
        projectId="projectId"
        groupId="groupId"
        lastSeen="2017-07-25T22:56:12Z"
        firstSeen="2017-07-01T02:06:02Z"
        numComments={14}
        shortId="shortId"
        logger="javascript logger"
        annotations={['annotation1', 'annotation2']}
      />
    );

    expect(toJson(component)).toMatchSnapshot();
  });

  it('details when mentioned', function() {
    let component = shallow(
      <EventOrGroupExtraDetails
        orgId="orgId"
        projectId="projectId"
        groupId="groupId"
        lastSeen="2017-07-25T22:56:12Z"
        firstSeen="2017-07-01T02:06:02Z"
        numComments={14}
        shortId="shortId"
        logger="javascript logger"
        annotations={['annotation1', 'annotation2']}
        subscriptionDetails={{reason: 'mentioned'}}
      />
    );

    expect(toJson(component)).toMatchSnapshot();
  });
});
