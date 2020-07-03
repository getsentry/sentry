import React from 'react';
import toJson from 'enzyme-to-json';

import {shallow} from 'sentry-test/enzyme';

import EventOrGroupExtraDetails from 'app/components/eventOrGroupExtraDetails';

describe('EventOrGroupExtraDetails', function() {
  it('renders last and first seen', function() {
    const component = shallow(
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
    const component = shallow(
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
    const component = shallow(
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
    const component = shallow(
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
        assignedTo={{
          name: 'Assignee Name',
        }}
        status="resolved"
      />
    );

    expect(toJson(component)).toMatchSnapshot();
  });

  it('renders assignee and status', function() {
    const component = shallow(
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
        assignedTo={{
          name: 'Assignee Name',
        }}
        status="resolved"
        showAssignee
        showStatus
      />
    );

    expect(toJson(component)).toMatchSnapshot();
  });

  it('details when mentioned', function() {
    const component = shallow(
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
