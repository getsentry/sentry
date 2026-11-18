import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import type {RoutableModuleNames} from 'sentry/views/insights/common/utils/useModuleURL';

import {getTraceViewParentCrumbs} from './breadcrumbs';

const organization = OrganizationFixture();

function moduleURLBuilder(moduleName: RoutableModuleNames) {
  return `insights/${moduleName}`;
}

describe('getTraceViewParentCrumbs', () => {
  it('links to the query summary when the source is the queries module with a group', () => {
    const location = LocationFixture({
      query: {source: 'queries_module', groupId: 'abc', node: 'span-1'},
    });

    const crumbs = getTraceViewParentCrumbs({organization, location, moduleURLBuilder});

    expect(crumbs).toEqual([
      {
        label: 'Query Summary',
        to: {
          pathname: '/organizations/org-slug/insights/db/spans/span/abc',
          query: {source: 'queries_module', groupId: 'abc'},
        },
      },
    ]);
  });

  it('links to the dashboard widget when the source is dashboards with both ids', () => {
    const location = LocationFixture({
      query: {source: 'dashboards', dashboardId: '1', widgetId: '2'},
    });

    const crumbs = getTraceViewParentCrumbs({organization, location, moduleURLBuilder});

    expect(crumbs.map(crumb => crumb.label)).toEqual([
      'Dashboards',
      'Widgets Legend',
      'Widget',
    ]);
    expect(crumbs[2]?.to).toEqual(
      expect.objectContaining({
        pathname: '/organizations/org-slug/dashboard/1/widget/2/',
      })
    );
  });

  it('links to the issue when the source is issue details with a group', () => {
    const location = LocationFixture({query: {source: 'issue_details', groupId: '42'}});

    const crumbs = getTraceViewParentCrumbs({organization, location, moduleURLBuilder});

    expect(crumbs.map(crumb => crumb.to)).toEqual([
      expect.objectContaining({pathname: '/organizations/org-slug/issues/'}),
      expect.objectContaining({pathname: '/organizations/org-slug/issues/42/'}),
    ]);
  });

  it('falls back to the traces list when the source is repeated', () => {
    const location = LocationFixture({query: {source: ['logs', 'logs']}});

    const crumbs = getTraceViewParentCrumbs({organization, location, moduleURLBuilder});

    expect(crumbs).toEqual([
      expect.objectContaining({
        label: 'Traces',
        to: expect.objectContaining({
          pathname: '/organizations/org-slug/explore/traces/',
        }),
      }),
    ]);
  });
});
