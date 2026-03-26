import {DashboardFixture} from 'sentry-fixture/dashboard';
import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {
  getLinkedDashboardPrebuiltIds,
  replacePlaceholderLinkedDashboardIds,
} from 'sentry/views/dashboards/utils/usePopulateLinkedDashboards';

describe('getLinkedDashboardPrebuiltIds', () => {
  it('returns empty array when widget has no linked dashboards', () => {
    expect(getLinkedDashboardPrebuiltIds(WidgetFixture())).toEqual([]);
  });

  it('extracts staticDashboardId values from linked dashboards', () => {
    const widget = WidgetFixture({
      queries: [
        WidgetQueryFixture({
          linkedDashboards: [
            {
              dashboardId: '-1',
              field: 'transaction',
              staticDashboardId: PrebuiltDashboardId.WEB_VITALS_SUMMARY,
            },
          ],
        }),
      ],
    });
    expect(getLinkedDashboardPrebuiltIds(widget)).toEqual([
      PrebuiltDashboardId.WEB_VITALS_SUMMARY,
    ]);
  });

  it('filters out linked dashboards without staticDashboardId', () => {
    const widget = WidgetFixture({
      queries: [
        WidgetQueryFixture({
          linkedDashboards: [{dashboardId: '42', field: 'transaction'}],
        }),
      ],
    });
    expect(getLinkedDashboardPrebuiltIds(widget)).toEqual([]);
  });
});

describe('replacePlaceholderLinkedDashboardIds', () => {
  it('replaces placeholder dashboardId with resolved id', () => {
    const dashboard = DashboardFixture([
      WidgetFixture({
        queries: [
          WidgetQueryFixture({
            linkedDashboards: [
              {
                dashboardId: '-1',
                field: 'transaction',
                staticDashboardId: PrebuiltDashboardId.WEB_VITALS_SUMMARY,
              },
            ],
          }),
        ],
      }),
    ]);

    const resolvedIdMap = new Map([[PrebuiltDashboardId.WEB_VITALS_SUMMARY, '99']]);
    const result = replacePlaceholderLinkedDashboardIds(dashboard, resolvedIdMap);
    expect(result.widgets[0]!.queries[0]!.linkedDashboards![0]!.dashboardId).toBe('99');
  });

  it('drops linked dashboard when no matching resolved dashboard is found', () => {
    const dashboard = DashboardFixture([
      WidgetFixture({
        queries: [
          WidgetQueryFixture({
            linkedDashboards: [
              {
                dashboardId: '-1',
                field: 'transaction',
                staticDashboardId: PrebuiltDashboardId.WEB_VITALS_SUMMARY,
              },
            ],
          }),
        ],
      }),
    ]);

    const result = replacePlaceholderLinkedDashboardIds(dashboard, new Map());
    expect(result.widgets[0]!.queries[0]!.linkedDashboards).toEqual([]);
  });
});
