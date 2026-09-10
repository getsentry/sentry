import {act} from '@testing-library/react'; // eslint-disable-line no-restricted-imports

import {createIssueListHandlers, projects} from 'sentry-test/msw/issueListHandlers';
import {server} from 'sentry-test/msw/server';
import {wrapFetchForRelativeURLs} from 'sentry-test/pageSnapshotSetup';
import {
  takePageSnapshot,
  type PageSnapshotConfig,
} from 'sentry-test/snapshots/pageSnapshot';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TagStore} from 'sentry/stores/tagStore';
import IssueListOverview from 'sentry/views/issueList/overview';

beforeAll(() => {
  server.listen({onUnhandledRequest: 'warn'});
  wrapFetchForRelativeURLs();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  server.use(...createIssueListHandlers());

  act(() => {
    ProjectsStore.loadInitialData(projects);
    TagStore.init?.();
    PageFiltersStore.onInitializeUrlState({
      projects: projects.map(p => parseInt(p.id, 10)),
      environments: [],
      datetime: {period: '14d', start: null, end: null, utc: null},
    });
  });
});

const THEMES = ['light', 'dark'] as const;

// Container sizes from the design system (static/app/utils/theme/scraps/tokens/size.tsx)
const CONTAINERS = [
  {label: '3xs', width: 320},
  {label: 'xs', width: 448},
  {label: 'xl', width: 768},
  {label: '5xl', width: 1280},
];

const baseConfig: Omit<PageSnapshotConfig, 'theme'> = {
  startUrl: '/organizations/org-slug/issues/',
  routes: [
    '/organizations/:orgId/issues/',
    '/organizations/:orgId/issues/searches/:searchId/',
    '/organizations/:orgId/issues/views/:viewId/',
  ],
};

describe('IssueList page snapshots', () => {
  for (const theme of THEMES) {
    for (const container of CONTAINERS) {
      test(`${theme} @${container.label}`, async () => {
        await takePageSnapshot({
          name: 'issue-list',
          renderFn: () => <IssueListOverview />,
          config: {...baseConfig, theme},
          viewport: container,
        });
      });
    }
  }
});
