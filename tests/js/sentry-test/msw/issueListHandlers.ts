import {http, HttpResponse} from 'msw';
import {GroupFixture} from 'sentry-fixture/group';
import {GroupStatsFixture} from 'sentry-fixture/groupStats';
import {MemberFixture} from 'sentry-fixture/member';
import {ProjectFixture} from 'sentry-fixture/project';
import {TagsFixture} from 'sentry-fixture/tags';

import {IssueCategory, IssueType, PriorityLevel} from 'sentry/types/group';

const DEFAULT_LINKS_HEADER =
  '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575731:0:1>; rel="previous"; results="false"; cursor="1443575731:0:1", ' +
  '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575000:0:0>; rel="next"; results="true"; cursor="1443575000:0:0"';

// Mock date is 2017-10-17T02:41:20.000Z (National Pasta Day).
// All fixture timestamps must be relative to that.
const jsProject = ProjectFixture({
  id: '100',
  name: 'javascript',
  slug: 'javascript',
  platform: 'javascript',
  firstEvent: '2017-01-15T00:00:00.000Z',
});

const pythonProject = ProjectFixture({
  id: '200',
  name: 'sentry-api',
  slug: 'sentry-api',
  platform: 'python',
  firstEvent: '2016-06-01T00:00:00.000Z',
});

const reactProject = ProjectFixture({
  id: '300',
  name: 'getsentry-frontend',
  slug: 'getsentry-frontend',
  platform: 'javascript-react',
  firstEvent: '2017-03-10T00:00:00.000Z',
});

export const projects = [jsProject, pythonProject, reactProject];

const groups = [
  GroupFixture({
    id: '101',
    project: jsProject,
    title: "TypeError: Cannot read properties of undefined (reading 'map')",
    metadata: {
      type: 'TypeError',
      value: "Cannot read properties of undefined (reading 'map')",
    },
    culprit: 'renderIssueList(app/views/issueList/overview)',
    shortId: 'JAVASCRIPT-4A2',
    count: '12847',
    userCount: 3201,
    priority: PriorityLevel.HIGH,
    level: 'error',
    firstSeen: '2017-10-10T14:22:00.000Z',
    lastSeen: '2017-10-17T01:15:00.000Z',
    isUnhandled: true,
  }),
  GroupFixture({
    id: '102',
    project: pythonProject,
    title: 'ConnectionError: Connection to database timed out after 30s',
    metadata: {
      type: 'ConnectionError',
      value: 'Connection to database timed out after 30s',
    },
    culprit: 'sentry.tasks.post_process.post_process_group',
    shortId: 'SENTRY-API-9FK',
    count: '89241',
    userCount: 0,
    priority: PriorityLevel.HIGH,
    level: 'error',
    platform: 'python',
    firstSeen: '2017-09-15T03:00:00.000Z',
    lastSeen: '2017-10-16T23:42:00.000Z',
    issueCategory: IssueCategory.ERROR,
    issueType: IssueType.ERROR,
  }),
  GroupFixture({
    id: '103',
    project: reactProject,
    title: 'ChunkLoadError: Loading chunk 7291 failed',
    metadata: {type: 'ChunkLoadError', value: 'Loading chunk 7291 failed'},
    culprit: 'lazy(app/views/settings/organizationMembers)',
    shortId: 'GETSENTRY-FE-2MN',
    count: '4519',
    userCount: 891,
    priority: PriorityLevel.MEDIUM,
    level: 'warning',
    firstSeen: '2017-10-14T18:30:00.000Z',
    lastSeen: '2017-10-16T20:00:00.000Z',
  }),
  GroupFixture({
    id: '104',
    project: jsProject,
    title: 'RangeError: Maximum call stack size exceeded',
    metadata: {type: 'RangeError', value: 'Maximum call stack size exceeded'},
    culprit: 'useInfiniteListItems(app/components/list/virtualizedList)',
    shortId: 'JAVASCRIPT-8B7',
    count: '201',
    userCount: 54,
    priority: PriorityLevel.MEDIUM,
    level: 'error',
    firstSeen: '2017-10-16T21:00:00.000Z',
    lastSeen: '2017-10-17T00:30:00.000Z',
    isUnhandled: true,
  }),
  GroupFixture({
    id: '105',
    project: pythonProject,
    title: 'ValueError: invalid literal for int() with base 10',
    metadata: {
      type: 'ValueError',
      value: "invalid literal for int() with base 10: 'abc'",
    },
    culprit: 'sentry.api.endpoints.organization_events.get',
    shortId: 'SENTRY-API-3QW',
    count: '67',
    userCount: 12,
    priority: PriorityLevel.LOW,
    level: 'warning',
    platform: 'python',
    firstSeen: '2017-10-17T00:00:00.000Z',
    lastSeen: '2017-10-17T02:15:00.000Z',
  }),
];

const groupStats = groups.map(g =>
  GroupStatsFixture({
    id: g.id,
    count: g.count,
    userCount: g.userCount,
    firstSeen: g.firstSeen,
    lastSeen: g.lastSeen,
    lifetime: {
      count: g.count,
      firstSeen: g.firstSeen,
      lastSeen: g.lastSeen,
      stats: g.stats ?? {},
      userCount: g.userCount,
    },
  })
);

export function createIssueListHandlers() {
  return [
    http.get('*/api/0/organizations/:orgSlug/issues/', () => {
      return HttpResponse.json(groups, {
        headers: {Link: DEFAULT_LINKS_HEADER},
      });
    }),

    http.get('*/api/0/organizations/:orgSlug/issues-stats/', () => {
      return HttpResponse.json(groupStats);
    }),

    http.get('*/api/0/organizations/:orgSlug/issues-count/', () => {
      return HttpResponse.json({});
    }),

    http.get('*/api/0/organizations/:orgSlug/recent-searches/', () => {
      return HttpResponse.json([]);
    }),

    http.post('*/api/0/organizations/:orgSlug/recent-searches/', () => {
      return HttpResponse.json([]);
    }),

    http.get('*/api/0/organizations/:orgSlug/processingissues/', () => {
      return HttpResponse.json([]);
    }),

    http.get('*/api/0/organizations/:orgSlug/tags/', () => {
      return HttpResponse.json(TagsFixture());
    }),

    http.get('*/api/0/organizations/:orgSlug/users/', () => {
      return HttpResponse.json([MemberFixture({projects: [jsProject.slug]})]);
    }),

    http.get('*/api/0/organizations/:orgSlug/members/', () => {
      return HttpResponse.json([MemberFixture()]);
    }),

    http.get('*/api/0/organizations/:orgSlug/sent-first-event/', () => {
      return HttpResponse.json({sentFirstEvent: true});
    }),

    http.get('*/api/0/organizations/:orgSlug/projects/', () => {
      return HttpResponse.json(projects);
    }),

    http.get('*/api/0/organizations/:orgSlug/group-search-views/', () => {
      return HttpResponse.json([]);
    }),

    http.get('*/api/0/organizations/:orgSlug/group-search-views/starred/', () => {
      return HttpResponse.json([]);
    }),

    http.get('*/api/0/*', () => {
      return HttpResponse.json([]);
    }),

    http.post('*/api/0/*', () => {
      return HttpResponse.json({});
    }),

    http.put('*/api/0/*', () => {
      return HttpResponse.json({});
    }),
  ];
}
