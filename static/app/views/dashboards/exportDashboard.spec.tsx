import {DashboardFixture} from 'sentry-fixture/dashboard';
import {WidgetFixture} from 'sentry-fixture/widget';

import {downloadObjectAsJson} from 'sentry/utils/downloadObjectAsJson';

import {
  DASHBOARD_EXPORT_VERSION,
  exportDashboard,
  parseDashboardExport,
} from './exportDashboard';

jest.mock('sentry/utils/downloadObjectAsJson');

describe('exportDashboard', () => {
  beforeEach(() => {
    jest.mocked(downloadObjectAsJson).mockClear();
  });

  it('exports a versioned payload without server-only fields', () => {
    const dashboard = DashboardFixture(
      [WidgetFixture({id: '7', dashboardId: '1', title: 'Errors by browser'})],
      {id: '1', title: 'My Dashboard', period: '7d', environment: ['prod']}
    );

    exportDashboard(dashboard);

    expect(downloadObjectAsJson).toHaveBeenCalledTimes(1);
    const [payload, filename] = jest.mocked(downloadObjectAsJson).mock.calls[0]!;

    expect(filename).toMatch(/^My-Dashboard-/);
    expect(payload).toEqual({
      version: DASHBOARD_EXPORT_VERSION,
      dashboard: expect.objectContaining({
        title: 'My Dashboard',
        period: '7d',
        environment: ['prod'],
      }),
    });

    const exported = (payload as {dashboard: Record<string, unknown>}).dashboard;
    expect(exported).not.toHaveProperty('id');
    expect(exported).not.toHaveProperty('createdBy');

    const [widget] = exported.widgets as Array<Record<string, unknown>>;
    expect(widget).toEqual(expect.objectContaining({title: 'Errors by browser'}));
    expect(widget).not.toHaveProperty('id');
    expect(widget).not.toHaveProperty('dashboardId');
  });

  it('round-trips through parseDashboardExport', () => {
    const dashboard = DashboardFixture([WidgetFixture()], {title: 'Round Trip'});

    exportDashboard(dashboard);
    const [payload] = jest.mocked(downloadObjectAsJson).mock.calls[0]!;

    const parsed = parseDashboardExport(JSON.parse(JSON.stringify(payload)));
    expect(parsed.title).toBe('Round Trip');
    expect(parsed.widgets).toHaveLength(1);
  });
});

describe('parseDashboardExport', () => {
  it('accepts legacy exports that have no version wrapper', () => {
    const legacy = {title: 'Legacy', widgets: []};

    expect(parseDashboardExport(legacy)).toBe(legacy);
  });

  it('rejects input that is not an object', () => {
    expect(() => parseDashboardExport('nope')).toThrow('expected a JSON object');
    expect(() => parseDashboardExport(null)).toThrow('expected a JSON object');
  });

  it('rejects files with neither a version nor a dashboard shape', () => {
    expect(() => parseDashboardExport({foo: 'bar'})).toThrow('missing version field');
  });

  it('rejects unsupported versions', () => {
    expect(() =>
      parseDashboardExport({version: 99, dashboard: {title: 'x', widgets: []}})
    ).toThrow('Unsupported export version: 99');
  });

  it('rejects versioned files without a valid dashboard', () => {
    expect(() => parseDashboardExport({version: DASHBOARD_EXPORT_VERSION})).toThrow(
      'missing dashboard data'
    );
    expect(() =>
      parseDashboardExport({version: DASHBOARD_EXPORT_VERSION, dashboard: {title: 'x'}})
    ).toThrow('must have a title and widgets');
  });
});
