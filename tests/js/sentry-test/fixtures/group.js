import {Project} from './project';

export function Group(params = {}) {
  const project = Project();
  return {
    activity: [],
    annotations: [],
    assignedTo: null,
    count: '327482',
    culprit: 'fetchData(app/components/group/suggestedOwners/suggestedOwners)',
    firstRelease: null,
    firstSeen: '2019-04-05T19:44:05.963Z',
    hasSeen: false,
    id: '1',
    isBookmarked: false,
    isPublic: false,
    isSubscribed: false,
    lastRelease: null,
    lastSeen: '2019-04-11T01:08:59Z',
    level: 'warning',
    logger: null,
    metadata: {function: 'fetchData', type: 'RequestError'},
    numComments: 0,
    participants: [],
    permalink: 'https://foo.io/organizations/foo/issues/1234/',
    platform: 'javascript',
    pluginActions: [],
    pluginContexts: [],
    pluginIssues: [],
    project: {
      platform: 'javascript',
      id: project.id,
      slug: project.slug,
    },
    seenBy: [],
    shareId: null,
    shortId: 'JAVASCRIPT-6QS',
    stats: {
      '24h': [
        [1517281200, 2],
        [1517310000, 1],
      ],
      '30d': [
        [1514764800, 1],
        [1515024000, 122],
      ],
    },
    status: 'unresolved',
    statusDetails: {},
    subscriptionDetails: null,
    // ex tag: {key: 'browser', name: 'Browser', totalValues: 1}
    tags: [],
    title: 'RequestError: GET /issues/ 404',
    type: 'error',
    userCount: 35097,
    userReportCount: 0,
    ...params,
  };
}
