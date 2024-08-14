import {render} from 'sentry-test/reactTestingLibrary';

import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import type {Group} from 'sentry/types/group';

describe('EventOrGroupExtraDetails', function () {
  it('renders last and first seen', function () {
    render(
      <EventOrGroupExtraDetails
        data={
          {
            project: {id: 'projectId'},
            id: 'groupId',
            lastSeen: '2017-07-25T22:56:12Z',
            firstSeen: '2017-07-01T02:06:02Z',
          } as Group
        }
      />
    );
  });

  it('renders only first seen', function () {
    render(
      <EventOrGroupExtraDetails
        data={
          {
            project: {id: 'projectId'},
            id: 'groupId',
            firstSeen: '2017-07-01T02:06:02Z',
          } as Group
        }
      />
    );
  });

  it('renders only last seen', function () {
    render(
      <EventOrGroupExtraDetails
        data={
          {
            project: {id: 'projectId'},
            id: 'groupId',
            lastSeen: '2017-07-25T22:56:12Z',
          } as Group
        }
      />
    );
  });

  it('renders all details', function () {
    render(
      <EventOrGroupExtraDetails
        data={
          {
            id: 'groupId',
            lastSeen: '2017-07-25T22:56:12Z',
            firstSeen: '2017-07-01T02:06:02Z',
            numComments: 14,
            shortId: 'shortId',
            logger: 'javascript logger',
            annotations: [
              {url: 'http://example.com', displayName: 'annotation1'},
              {url: 'http://example.com', displayName: 'annotation2'},
            ],
            assignedTo: {
              name: 'Assignee Name',
            },
            status: 'resolved',
          } as Group
        }
      />
    );
  });

  it('renders assignee and status', function () {
    render(
      <EventOrGroupExtraDetails
        data={
          {
            id: 'groupId',
            lastSeen: '2017-07-25T22:56:12Z',
            firstSeen: '2017-07-01T02:06:02Z',
            numComments: 14,
            shortId: 'shortId',
            logger: 'javascript logger',
            annotations: [
              {url: 'http://example.com', displayName: 'annotation1'},
              {url: 'http://example.com', displayName: 'annotation2'},
            ],
            assignedTo: {
              name: 'Assignee Name',
            },
            status: 'resolved',
          } as Group
        }
        showAssignee
      />
    );
  });

  it('details when mentioned', function () {
    render(
      <EventOrGroupExtraDetails
        data={
          {
            id: 'groupId',
            lastSeen: '2017-07-25T22:56:12Z',
            firstSeen: '2017-07-01T02:06:02Z',
            numComments: 14,
            shortId: 'shortId',
            logger: 'javascript logger',
            annotations: [
              {url: 'http://example.com', displayName: 'annotation1'},
              {url: 'http://example.com', displayName: 'annotation2'},
            ],
            subscriptionDetails: {reason: 'mentioned'},
          } as Group
        }
      />
    );
  });
});
