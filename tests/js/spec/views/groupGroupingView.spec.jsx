/* eslint-env jest */
import React from 'react';
import {mount, shallow} from 'enzyme';
import toJson from 'enzyme-to-json';

import GroupGroupingView from 'app/views/groupGrouping/groupGroupingView';
import {Client} from 'app/api';

jest.mock('app/api');
jest.mock('app/mixins/projectState', () => {
  return {
    getFeatures: () => new Set(['callsigns']),
    getProjectFeatures: () => new Set(['similarity-view'])
  };
});

const mockData = {
  similar: [
    [
      {
        lastSeen: '2017-07-25T02:22:19Z',
        numComments: 0,
        userCount: 1,
        culprit: 'Constructor.onGroupingUpdate(app/views/groupGrouping/groupingMergedList)',
        title: 'ReferenceError: unmergedList is not defined',
        id: '274',
        assignedTo: null,
        logger: 'javascript',
        type: 'error',
        annotations: [],
        metadata: {type: 'ReferenceError', value: 'unmergedList is not defined'},
        status: 'unresolved',
        subscriptionDetails: null,
        isPublic: false,
        hasSeen: false,
        shortId: 'INTERNAL-4K',
        shareId: '312e323734',
        firstSeen: '2017-07-25T02:21:52Z',
        count: '2',
        permalink: 'http://localhost:8000/sentry/internal/issues/274/',
        level: 'error',
        isSubscribed: true,
        isBookmarked: false,
        project: {name: 'Internal', slug: 'internal'},
        statusDetails: {}
      },
      {'exception:stacktrace:pairs': 0.375}
    ],
    [
      {
        lastSeen: '2017-07-25T02:20:35Z',
        numComments: 0,
        userCount: 1,
        culprit: 'size(app/views/groupGrouping/groupingMergedList)',
        title: "TypeError: Cannot read property 'size' of undefined",
        id: '275',
        assignedTo: null,
        logger: 'javascript',
        type: 'error',
        annotations: [],
        metadata: {type: 'TypeError', value: "Cannot read property 'size' of undefined"},
        status: 'unresolved',
        subscriptionDetails: null,
        isPublic: false,
        hasSeen: true,
        shortId: 'INTERNAL-4M',
        shareId: '312e323735',
        firstSeen: '2017-07-25T02:20:35Z',
        count: '1',
        permalink: 'http://localhost:8000/sentry/internal/issues/275/',
        level: 'error',
        isSubscribed: true,
        isBookmarked: false,
        project: {name: 'Internal', slug: 'internal'},
        statusDetails: {}
      },
      {'exception:stacktrace:pairs': 0.375}
    ],
    [
      {
        lastSeen: '2017-07-24T23:41:44Z',
        numComments: 0,
        userCount: 3,
        culprit: 'length(app/views/groupGrouping/groupGroupingView)',
        title: "TypeError: Cannot read property 'length' of undefined",
        id: '271',
        assignedTo: null,
        logger: 'javascript',
        type: 'error',
        annotations: [],
        metadata: {
          type: 'TypeError',
          value: "Cannot read property 'length' of undefined"
        },
        status: 'unresolved',
        subscriptionDetails: null,
        isPublic: false,
        hasSeen: false,
        shortId: 'INTERNAL-4G',
        shareId: '312e323731',
        firstSeen: '2017-07-10T18:32:43Z',
        count: '90',
        permalink: 'http://localhost:8000/sentry/internal/issues/271/',
        level: 'error',
        isSubscribed: true,
        isBookmarked: false,
        project: {name: 'Internal', slug: 'internal'},
        statusDetails: {}
      },
      {'exception:stacktrace:pairs': 0.01264}
    ],
    [
      {
        lastSeen: '2017-07-25T23:21:19Z',
        numComments: 0,
        userCount: 1,
        culprit: 'stale(app/views/groupDetails)',
        title: "TypeError: Cannot read property 'stale' of undefined",
        id: '216',
        assignedTo: {
          username: 'billy@sentry.io',
          isManaged: false,
          lastActive: '2017-07-26T18:28:19.391Z',
          identities: [],
          id: '1',
          isActive: true,
          has2fa: false,
          name: 'billy@sentry.io',
          avatarUrl: 'https://secure.gravatar.com/avatar/7b544e8eb9d08ed777be5aa82121155a?s=32&d=mm',
          dateJoined: '2017-06-26T21:02:13.264Z',
          emails: [{is_verified: false, id: '1', email: 'billy@sentry.io'}],
          avatar: {avatarUuid: null, avatarType: 'letter_avatar'},
          lastLogin: '2017-07-25T01:00:50.473Z',
          email: 'billy@sentry.io'
        },
        logger: 'javascript',
        type: 'error',
        annotations: [],
        metadata: {type: 'TypeError', value: "Cannot read property 'stale' of undefined"},
        status: 'unresolved',
        subscriptionDetails: {reason: 'changed_status'},
        isPublic: false,
        hasSeen: true,
        shortId: 'INTERNAL-2S',
        shareId: '312e323136',
        firstSeen: '2017-07-25T02:20:35Z',
        count: '15',
        permalink: 'http://localhost:8000/sentry/internal/issues/216/',
        level: 'error',
        isSubscribed: true,
        isBookmarked: false,
        project: {name: 'Internal', slug: 'internal'},
        statusDetails: {}
      },
      {
        'exception:stacktrace:application-chunks': 0.000235,
        'exception:stacktrace:pairs': 0.001488
      }
    ]
  ],
  merged: [
    {
      latestEvent: {
        eventID: '807f0de4d8c246098f21f8e0f1684f3d',
        packages: {},
        dist: null,
        tags: [
          {value: 'Chrome 59.0.3071', key: 'browser'},
          {value: 'Chrome', key: 'browser.name'},
          {value: 'error', key: 'level'},
          {value: 'javascript', key: 'logger'},
          {value: 'Mac OS X 10.12.5', key: 'os'},
          {value: 'Mac OS X', key: 'os.name'},
          {value: 'd5241c9d9d2bcda918c7af72f07cea1e39a096ac', key: 'release'},
          {
            value: 'app/components/assigneeSelector in assignedTo',
            key: 'transaction'
          },
          {
            value: 'http://localhost:8000/sentry/internal/issues/227/grouping/',
            key: 'url'
          },
          {value: 'id:1', key: 'user'}
        ],
        contexts: {
          os: {version: '10.12.5', type: 'os', name: 'Mac OS X'},
          browser: {version: '59.0.3071', type: 'browser', name: 'Chrome'}
        },
        dateReceived: '2017-07-26T00:34:20Z',
        dateCreated: '2017-07-26T00:34:20Z',
        fingerprints: [
          '2c4887696f708c476a81ce4e834c4b02',
          'e05da55328a860b21f62e371f0a7507d'
        ],
        metadata: {
          type: 'TypeError',
          value: "Cannot read property 'assignedTo' of undefined"
        },
        groupID: '268',
        platform: 'javascript',
        errors: [],
        user: {ip_address: '127.0.0.1', email: 'billy@sentry.io', id: '1'},
        context: {'session:duration': 46363},
        entries: [],
        message: "TypeError Cannot read property 'assignedTo' of undefined app/components/assigneeSelector in assignedTo",
        sdk: {
          clientIP: '127.0.0.1',
          version: '3.16.1',
          name: 'raven-js',
          upstream: {
            url: 'https://docs.sentry.io/clients/javascript/',
            isNewer: false,
            name: 'raven-js'
          }
        },
        type: 'error',
        id: '904',
        size: 21896
      },
      state: 'unlocked',
      id: '2c4887696f708c476a81ce4e834c4b02'
    },
    {
      latestEvent: {
        eventID: '807f0de4d8c246098f21f8e0f1684f3d',
        packages: {},
        dist: null,
        tags: [
          {value: 'Chrome 59.0.3071', key: 'browser'},
          {value: 'Chrome', key: 'browser.name'},
          {value: 'error', key: 'level'},
          {value: 'javascript', key: 'logger'},
          {value: 'Mac OS X 10.12.5', key: 'os'},
          {value: 'Mac OS X', key: 'os.name'},
          {value: 'd5241c9d9d2bcda918c7af72f07cea1e39a096ac', key: 'release'},
          {
            value: 'app/components/assigneeSelector in assignedTo',
            key: 'transaction'
          },
          {
            value: 'http://localhost:8000/sentry/internal/issues/227/grouping/',
            key: 'url'
          },
          {value: 'id:1', key: 'user'}
        ],
        contexts: {
          os: {version: '10.12.5', type: 'os', name: 'Mac OS X'},
          browser: {version: '59.0.3071', type: 'browser', name: 'Chrome'}
        },
        dateReceived: '2017-07-26T00:34:20Z',
        dateCreated: '2017-07-26T00:34:20Z',
        fingerprints: [
          '2c4887696f708c476a81ce4e834c4b02',
          'e05da55328a860b21f62e371f0a7507d'
        ],
        metadata: {
          type: 'TypeError',
          value: "Cannot read property 'assignedTo' of undefined"
        },
        groupID: '268',
        platform: 'javascript',
        errors: [],
        user: {ip_address: '127.0.0.1', email: 'billy@sentry.io', id: '1'},
        context: {'session:duration': 46363},
        entries: [],
        message: "TypeError Cannot read property 'assignedTo' of undefined app/components/assigneeSelector in assignedTo",
        sdk: {
          clientIP: '127.0.0.1',
          version: '3.16.1',
          name: 'raven-js',
          upstream: {
            url: 'https://docs.sentry.io/clients/javascript/',
            isNewer: false,
            name: 'raven-js'
          }
        },
        type: 'error',
        id: '904',
        size: 21896
      },
      state: 'unlocked',
      id: 'e05da55328a860b21f62e371f0a7507d'
    }
  ]
};

describe('Issues Grouping View', function() {
  beforeAll(function() {
    Client.addMockResponse({
      url: '/issues/groupId/hashes/?limit=50',
      body: mockData.merged
    });
    Client.addMockResponse({
      url: '/issues/groupId/similar/?limit=50',
      body: mockData.similar
    });
  });

  it('renders initially with loading component', function() {
    let component = shallow(
      <GroupGroupingView params={{groupId: 'groupId'}} location={{}} />
    );

    expect(toJson(component)).toMatchSnapshot();
  });

  it('renders with mocked data', function(done) {
    let wrapper = mount(
      <GroupGroupingView
        params={{orgId: 'orgId', projectId: 'projectId', groupId: 'groupId'}}
        location={{}}
      />
    );

    wrapper.instance().componentDidUpdate = jest.fn(() => {
      expect(toJson(wrapper)).toMatchSnapshot();
      done();
    });
  });
});
