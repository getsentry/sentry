import {FieldKind} from 'sentry/utils/fields';
import type {
  DashboardFilters,
  GlobalFilter,
  LinkedDashboard,
} from 'sentry/views/dashboards/types';
import {DashboardFilterKeys, WidgetType} from 'sentry/views/dashboards/types';
import {getLinkedDashboardUrl} from 'sentry/views/dashboards/utils/getLinkedDashboardUrl';

describe('getLinkedDashboardUrl', () => {
  const organizationSlug = 'test-org';

  const linkedDashboard: LinkedDashboard = {
    dashboardId: '123',
    field: 'browser.name',
  };

  it('returns undefined for invalid dashboard ID', () => {
    const result = getLinkedDashboardUrl({
      linkedDashboard: {dashboardId: '', field: 'browser.name'},
      organizationSlug,
      field: 'browser.name',
      value: 'Chrome',
    });

    expect(result).toBeUndefined();
  });

  it('returns undefined for placeholder dashboard ID', () => {
    const result = getLinkedDashboardUrl({
      linkedDashboard: {dashboardId: '-1', field: 'browser.name'},
      organizationSlug,
      field: 'browser.name',
      value: 'Chrome',
    });

    expect(result).toBeUndefined();
  });

  it('returns a URL with temporary global filter for the field value', () => {
    const result = getLinkedDashboardUrl({
      linkedDashboard,
      organizationSlug,
      field: 'browser.name',
      value: 'Chrome',
    });

    const expectedFilter: GlobalFilter = {
      dataset: WidgetType.SPANS,
      tag: {key: 'browser.name', name: 'browser.name', kind: FieldKind.TAG},
      value: 'browser.name:Chrome',
      isTemporary: true,
    };

    expect(result).toBe(
      `/organizations/test-org/dashboard/123/?${DashboardFilterKeys.GLOBAL_FILTER}=${encodeURIComponent(JSON.stringify(expectedFilter))}`
    );
  });

  it('preserves existing global filters', () => {
    const existingFilter: GlobalFilter = {
      dataset: WidgetType.SPANS,
      tag: {key: 'environment', name: 'environment', kind: FieldKind.TAG},
      value: 'environment:production',
      isTemporary: false,
    };

    const dashboardFilters: DashboardFilters = {
      [DashboardFilterKeys.GLOBAL_FILTER]: [existingFilter],
    };

    const result = getLinkedDashboardUrl({
      linkedDashboard,
      organizationSlug,
      field: 'browser.name',
      value: 'Chrome',
      dashboardFilters,
    });

    const expectedNewFilter: GlobalFilter = {
      dataset: WidgetType.SPANS,
      tag: {key: 'browser.name', name: 'browser.name', kind: FieldKind.TAG},
      value: 'browser.name:Chrome',
      isTemporary: true,
    };

    expect(result).toBe(
      `/organizations/test-org/dashboard/123/?${DashboardFilterKeys.GLOBAL_FILTER}=${encodeURIComponent(JSON.stringify(existingFilter))}&${DashboardFilterKeys.GLOBAL_FILTER}=${encodeURIComponent(JSON.stringify(expectedNewFilter))}`
    );
  });

  it('removes duplicate filters for the same field and dataset', () => {
    const dashboardFilters: DashboardFilters = {
      [DashboardFilterKeys.GLOBAL_FILTER]: [
        {
          dataset: WidgetType.SPANS,
          tag: {key: 'browser.name', name: 'browser.name', kind: FieldKind.TAG},
          value: 'browser.name:Firefox',
          isTemporary: true,
        },
      ],
    };

    const result = getLinkedDashboardUrl({
      linkedDashboard,
      organizationSlug,
      field: 'browser.name',
      value: 'Chrome',
      dashboardFilters,
    });

    const expectedFilter: GlobalFilter = {
      dataset: WidgetType.SPANS,
      tag: {key: 'browser.name', name: 'browser.name', kind: FieldKind.TAG},
      value: 'browser.name:Chrome',
      isTemporary: true,
    };

    expect(result).toBe(
      `/organizations/test-org/dashboard/123/?${DashboardFilterKeys.GLOBAL_FILTER}=${encodeURIComponent(JSON.stringify(expectedFilter))}`
    );
  });

  it('preserves page filter params from location query', () => {
    const result = getLinkedDashboardUrl({
      linkedDashboard,
      organizationSlug,
      field: 'browser.name',
      value: 'Chrome',
      locationQuery: {
        project: '1',
        environment: 'production',
        statsPeriod: '7d',
        release: '1.0.0',
        unrelatedParam: 'should-be-ignored',
      },
    });

    const expectedFilter: GlobalFilter = {
      dataset: WidgetType.SPANS,
      tag: {key: 'browser.name', name: 'browser.name', kind: FieldKind.TAG},
      value: 'browser.name:Chrome',
      isTemporary: true,
    };

    expect(result).toBe(
      `/organizations/test-org/dashboard/123/?environment=production&${DashboardFilterKeys.GLOBAL_FILTER}=${encodeURIComponent(JSON.stringify(expectedFilter))}&project=1&release=1.0.0&statsPeriod=7d`
    );
  });

  it('overrides project with projectIdOverride', () => {
    const result = getLinkedDashboardUrl({
      linkedDashboard,
      organizationSlug,
      field: 'browser.name',
      value: 'Chrome',
      locationQuery: {
        project: '1',
      },
      projectIdOverride: '999',
    });

    const expectedFilter: GlobalFilter = {
      dataset: WidgetType.SPANS,
      tag: {key: 'browser.name', name: 'browser.name', kind: FieldKind.TAG},
      value: 'browser.name:Chrome',
      isTemporary: true,
    };

    expect(result).toBe(
      `/organizations/test-org/dashboard/123/?${DashboardFilterKeys.GLOBAL_FILTER}=${encodeURIComponent(JSON.stringify(expectedFilter))}&project=999`
    );
  });

  it('applies filters to additional dataset targets', () => {
    const linkedDashboardWithTargets: LinkedDashboard = {
      dashboardId: '123',
      field: 'browser.name',
      additionalGlobalFilterDatasetTargets: [WidgetType.ERRORS],
    };

    const result = getLinkedDashboardUrl({
      linkedDashboard: linkedDashboardWithTargets,
      organizationSlug,
      field: 'browser.name',
      value: 'Chrome',
      widgetType: WidgetType.SPANS,
    });

    const expectedSpansFilter: GlobalFilter = {
      dataset: WidgetType.SPANS,
      tag: {key: 'browser.name', name: 'browser.name', kind: FieldKind.TAG},
      value: 'browser.name:Chrome',
      isTemporary: true,
    };

    const expectedErrorsFilter: GlobalFilter = {
      dataset: WidgetType.ERRORS,
      tag: {key: 'browser.name', name: 'browser.name', kind: FieldKind.TAG},
      value: 'browser.name:Chrome',
      isTemporary: true,
    };

    expect(result).toBe(
      `/organizations/test-org/dashboard/123/?${DashboardFilterKeys.GLOBAL_FILTER}=${encodeURIComponent(JSON.stringify(expectedSpansFilter))}&${DashboardFilterKeys.GLOBAL_FILTER}=${encodeURIComponent(JSON.stringify(expectedErrorsFilter))}`
    );
  });

  it('applies filters to multiple additional dataset targets', () => {
    const linkedDashboardWithTargets: LinkedDashboard = {
      dashboardId: '123',
      field: 'browser.name',
      additionalGlobalFilterDatasetTargets: [WidgetType.ERRORS, WidgetType.TRANSACTIONS],
    };

    const result = getLinkedDashboardUrl({
      linkedDashboard: linkedDashboardWithTargets,
      organizationSlug,
      field: 'browser.name',
      value: 'Chrome',
      widgetType: WidgetType.SPANS,
    });

    const expectedSpansFilter: GlobalFilter = {
      dataset: WidgetType.SPANS,
      tag: {key: 'browser.name', name: 'browser.name', kind: FieldKind.TAG},
      value: 'browser.name:Chrome',
      isTemporary: true,
    };

    const expectedErrorsFilter: GlobalFilter = {
      dataset: WidgetType.ERRORS,
      tag: {key: 'browser.name', name: 'browser.name', kind: FieldKind.TAG},
      value: 'browser.name:Chrome',
      isTemporary: true,
    };

    const expectedTransactionsFilter: GlobalFilter = {
      dataset: WidgetType.TRANSACTIONS,
      tag: {key: 'browser.name', name: 'browser.name', kind: FieldKind.TAG},
      value: 'browser.name:Chrome',
      isTemporary: true,
    };

    expect(result).toBe(
      `/organizations/test-org/dashboard/123/?${DashboardFilterKeys.GLOBAL_FILTER}=${encodeURIComponent(JSON.stringify(expectedSpansFilter))}&${DashboardFilterKeys.GLOBAL_FILTER}=${encodeURIComponent(JSON.stringify(expectedErrorsFilter))}&${DashboardFilterKeys.GLOBAL_FILTER}=${encodeURIComponent(JSON.stringify(expectedTransactionsFilter))}`
    );
  });

  it('properly escapes special characters in values', () => {
    const result = getLinkedDashboardUrl({
      linkedDashboard,
      organizationSlug,
      field: 'browser.name',
      value: 'Chrome "Browser"',
    });

    const expectedFilter: GlobalFilter = {
      dataset: WidgetType.SPANS,
      tag: {key: 'browser.name', name: 'browser.name', kind: FieldKind.TAG},
      value: 'browser.name:"Chrome \\"Browser\\""',
      isTemporary: true,
    };

    expect(result).toBe(
      `/organizations/test-org/dashboard/123/?${DashboardFilterKeys.GLOBAL_FILTER}=${encodeURIComponent(JSON.stringify(expectedFilter))}`
    );
  });
});
