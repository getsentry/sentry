import {NUM_DESKTOP_COLS} from 'sentry/views/dashboards/constants';
import {
  PREBUILT_DASHBOARDS,
  PrebuiltDashboardId,
} from 'sentry/views/dashboards/utils/prebuiltConfigs';

// Must match the limits enforced by the backend serializer at
// src/sentry/api/serializers/rest_framework/dashboard.py.
const MAX_WIDGET_DESCRIPTION_LENGTH = 350;
const MAX_WIDGET_TITLE_LENGTH = 255;
const MAX_DASHBOARD_TITLE_LENGTH = 255;

const entries = Object.entries(PREBUILT_DASHBOARDS) as Array<
  [`${PrebuiltDashboardId}`, (typeof PREBUILT_DASHBOARDS)[PrebuiltDashboardId]]
>;

describe('PREBUILT_DASHBOARDS', () => {
  it.each(entries)('dashboard %s has a title within the backend limit', (_id, config) => {
    expect(config.title.length).toBeLessThanOrEqual(MAX_DASHBOARD_TITLE_LENGTH);
  });

  describe.each(entries)('dashboard %s widgets', (_id, config) => {
    it.each(
      config.widgets.map((widget, index) => [index, widget.title, widget] as const)
    )('widget %i (%s) passes backend validation', (_index, _title, widget) => {
      expect(widget.title.length).toBeLessThanOrEqual(MAX_WIDGET_TITLE_LENGTH);
      expect(widget.description?.length ?? 0).toBeLessThanOrEqual(
        MAX_WIDGET_DESCRIPTION_LENGTH
      );

      // x and w bounds are enforced by PrebuiltWidgetLayout's literal-union
      // types; only the wide fields and the cross-field x+w invariant
      // need runtime checks.
      const layout = widget.layout;
      if (layout) {
        expect(layout.y).toBeGreaterThanOrEqual(0);
        expect(layout.h).toBeGreaterThanOrEqual(1);
        expect(layout.minH).toBeGreaterThanOrEqual(1);
        expect(layout.x + layout.w).toBeLessThanOrEqual(NUM_DESKTOP_COLS);
      }
    });
  });
});
