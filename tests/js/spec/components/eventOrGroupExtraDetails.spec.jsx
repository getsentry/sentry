import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';

describe('EventOrGroupExtraDetails', function () {
  const {routerContext} = initializeOrg();

  it('renders last and first seen', function () {
    const {container} = mountWithTheme(
      <EventOrGroupExtraDetails
        data={{
          orgId: 'orgId',
          projectId: 'projectId',
          groupId: 'groupId',
          lastSeen: '2017-07-25T22:56:12Z',
          firstSeen: '2017-07-01T02:06:02Z',
        }}
      />,
      {context: routerContext}
    );

    expect(container).toSnapshot();
  });

  it('renders only first seen', function () {
    const {container} = mountWithTheme(
      <EventOrGroupExtraDetails
        data={{
          orgId: 'orgId',
          projectId: 'projectId',
          groupId: 'groupId',
          firstSeen: '2017-07-01T02:06:02Z',
        }}
      />,
      {context: routerContext}
    );

    expect(container).toSnapshot();
  });

  it('renders only last seen', function () {
    const {container} = mountWithTheme(
      <EventOrGroupExtraDetails
        data={{
          orgId: 'orgId',
          projectId: 'projectId',
          groupId: 'groupId',
          lastSeen: '2017-07-25T22:56:12Z',
        }}
      />,
      {context: routerContext}
    );

    expect(container).toSnapshot();
  });

  it('renders all details', function () {
    const {container} = mountWithTheme(
      <EventOrGroupExtraDetails
        data={{
          orgId: 'orgId',
          projectId: 'projectId',
          groupId: 'groupId',
          lastSeen: '2017-07-25T22:56:12Z',
          firstSeen: '2017-07-01T02:06:02Z',
          numComments: 14,
          shortId: 'shortId',
          logger: 'javascript logger',
          annotations: ['annotation1', 'annotation2'],
          assignedTo: {
            name: 'Assignee Name',
          },
          status: 'resolved',
        }}
      />,
      {context: routerContext}
    );

    expect(container).toSnapshot();
  });

  it('renders assignee and status', function () {
    const {container} = mountWithTheme(
      <EventOrGroupExtraDetails
        data={{
          orgId: 'orgId',
          projectId: 'projectId',
          groupId: 'groupId',
          lastSeen: '2017-07-25T22:56:12Z',
          firstSeen: '2017-07-01T02:06:02Z',
          numComments: 14,
          shortId: 'shortId',
          logger: 'javascript logger',
          annotations: ['annotation1', 'annotation2'],
          assignedTo: {
            name: 'Assignee Name',
          },
          status: 'resolved',
          showStatus: true,
        }}
        showAssignee
      />,
      {context: routerContext}
    );

    expect(container).toSnapshot();
  });

  it('details when mentioned', function () {
    const {container} = mountWithTheme(
      <EventOrGroupExtraDetails
        data={{
          orgId: 'orgId',
          projectId: 'projectId',
          groupId: 'groupId',
          lastSeen: '2017-07-25T22:56:12Z',
          firstSeen: '2017-07-01T02:06:02Z',
          numComments: 14,
          shortId: 'shortId',
          logger: 'javascript logger',
          annotations: ['annotation1', 'annotation2'],
          subscriptionDetails: {reason: 'mentioned'},
        }}
      />,
      {context: routerContext}
    );

    expect(container).toSnapshot();
  });
});
