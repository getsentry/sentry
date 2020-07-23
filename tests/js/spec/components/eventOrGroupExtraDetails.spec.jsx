import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import EventOrGroupExtraDetails from 'app/components/eventOrGroupExtraDetails';

import {initializeOrg} from '../../sentry-test/initializeOrg';

describe('EventOrGroupExtraDetails', function() {
  const {routerContext} = initializeOrg();

  it('renders last and first seen', function() {
    const component = mountWithTheme(
      <EventOrGroupExtraDetails
        orgId="orgId"
        projectId="projectId"
        groupId="groupId"
        lastSeen="2017-07-25T22:56:12Z"
        firstSeen="2017-07-01T02:06:02Z"
      />,
      routerContext
    );

    expect(component).toSnapshot();
    expect(component).toMatchSnapshot();
  });

  it('renders only first seen', function() {
    const component = mountWithTheme(
      <EventOrGroupExtraDetails
        orgId="orgId"
        projectId="projectId"
        groupId="groupId"
        firstSeen="2017-07-01T02:06:02Z"
      />,
      routerContext
    );

    expect(component).toSnapshot();
    expect(component).toMatchSnapshot();
  });

  it('renders only last seen', function() {
    const component = mountWithTheme(
      <EventOrGroupExtraDetails
        orgId="orgId"
        projectId="projectId"
        groupId="groupId"
        lastSeen="2017-07-25T22:56:12Z"
      />,
      routerContext
    );

    expect(component).toSnapshot();
    expect(component).toMatchSnapshot();
  });

  it('renders all details', function() {
    const component = mountWithTheme(
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
      />,
      routerContext
    );

    expect(component).toSnapshot();
    expect(component).toMatchSnapshot();
  });

  it('renders assignee and status', function() {
    const component = mountWithTheme(
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
      />,
      routerContext
    );

    expect(component).toSnapshot();
    expect(component).toMatchSnapshot();
  });

  it('details when mentioned', function() {
    const component = mountWithTheme(
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
      />,
      routerContext
    );

    expect(component).toSnapshot();
    expect(component).toMatchSnapshot();
  });
});
