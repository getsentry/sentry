import {DashboardListItemFixture} from 'sentry-fixture/dashboard';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  buildLandingSections,
  getDataSourcesFromTitle,
  getProjectFrameworks,
  toLandingDashboard,
} from 'sentry/views/dashboards/landing/utils';
import {WidgetType} from 'sentry/views/dashboards/types';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';

describe('dashboards landing utils', () => {
  it('derives data sources from widget types before falling back to the title', () => {
    const dashboard = DashboardListItemFixture({id: '1', title: 'Checkout errors'});

    expect([...toLandingDashboard(dashboard).dataSources]).toEqual(['errors']);
    expect([
      ...toLandingDashboard(dashboard, [WidgetType.SPANS, WidgetType.LOGS]).dataSources,
    ]).toEqual(['spans', 'logs']);
    expect([...getDataSourcesFromTitle('API latency')]).toEqual(['spans']);
  });

  it('groups projects by framework, most common first', () => {
    const projects = [
      ProjectFixture({id: '1', platform: 'python-django'}),
      ProjectFixture({id: '2', platform: 'javascript-nextjs'}),
      ProjectFixture({id: '3', platform: 'python-flask'}),
      ProjectFixture({id: '4', platform: 'ruby'}),
    ];

    expect(getProjectFrameworks(projects).map(({framework}) => framework.key)).toEqual([
      'python',
      'nextjs',
    ]);
  });

  it('builds recommended and framework sections from project platforms', () => {
    const projects = [ProjectFixture({id: '7', platform: 'javascript-nextjs'})];
    const nextjs = toLandingDashboard(
      DashboardListItemFixture({
        id: '10',
        title: 'Next.js Overview',
        prebuiltId: PrebuiltDashboardId.NEXTJS_FRONTEND_OVERVIEW,
      })
    );
    const laravel = toLandingDashboard(
      DashboardListItemFixture({
        id: '11',
        title: 'Laravel Overview',
        prebuiltId: PrebuiltDashboardId.LARAVEL_OVERVIEW,
      })
    );
    const custom = toLandingDashboard(
      DashboardListItemFixture({id: '12', title: 'Storefront', projects: [7]})
    );

    const sections = buildLandingSections({
      dashboards: [nextjs, laravel, custom],
      mostPopular: [],
      recentlyViewed: [],
      projects,
      userId: '1',
    });
    const byKey = Object.fromEntries(sections.map(section => [section.key, section]));

    expect(byKey.recommended!.items.map(item => item.dashboard.id)).toEqual(['10']);
    expect(byKey['framework-nextjs']!.items.map(item => item.dashboard.id)).toEqual([
      '10',
      '12',
    ]);
  });
});
