import {Project as MockProject} from 'sentry-fixture/project';

import {
  EventOrGroupType,
  type Group as GroupType,
  GroupStatus,
  GroupUnresolved,
  IssueCategory,
  IssueType,
} from 'sentry/types';

export function Group(params: Partial<GroupType> = {}): GroupType {
  const unresolvedGroup: GroupUnresolved = {
    activity: [],
    annotations: [],
    assignedTo: null,
    count: '327482',
    culprit: 'fetchData(app/components/group/suggestedOwners/suggestedOwners)',
    firstSeen: '2019-04-05T19:44:05.963Z',
    filtered: null,
    hasSeen: false,
    id: '1',
    isBookmarked: false,
    isPublic: false,
    isSubscribed: false,
    isUnhandled: false,
    issueCategory: IssueCategory.ERROR,
    issueType: IssueType.ERROR,
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
    project: MockProject({
      platform: 'javascript',
    }),
    seenBy: [],
    shareId: '',
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
    status: GroupStatus.UNRESOLVED,
    statusDetails: {},
    subscriptionDetails: null,
    title: 'RequestError: GET /issues/ 404',
    type: EventOrGroupType.ERROR,
    userCount: 35097,
    userReportCount: 0,
  };

  return {...unresolvedGroup, ...params} as GroupType;
}
