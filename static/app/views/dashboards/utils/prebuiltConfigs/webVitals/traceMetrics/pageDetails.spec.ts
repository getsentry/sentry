import {WidgetType} from 'sentry/views/dashboards/types';
import {webVitalCountField} from 'sentry/views/dashboards/utils/webVitalTraceMetricFields';

import {WEB_VITALS_DETAILS_TRACE_METRICS_PREBUILT_CONFIG} from './pageDetails';

describe('WEB_VITALS_DETAILS_TRACE_METRICS_PREBUILT_CONFIG', () => {
  const {widgets, filters} = WEB_VITALS_DETAILS_TRACE_METRICS_PREBUILT_CONFIG;

  it('only ships trace metrics global filters', () => {
    expect(filters?.globalFilter).not.toHaveLength(0);
    for (const filter of filters?.globalFilter ?? []) {
      expect(filter.dataset).toBe(WidgetType.TRACEMETRICS);
    }
  });

  it('puts every non-issue widget on trace metrics', () => {
    for (const widget of widgets) {
      if (widget.widgetType !== WidgetType.ISSUE) {
        expect(widget.widgetType).toBe(WidgetType.TRACEMETRICS);
      }
    }
  });

  it('narrows each samples table to its vital metric', () => {
    for (const vital of ['lcp', 'inp', 'cls']) {
      const table = widgets.find(widget => widget.id === `${vital}-samples-table`);
      const query = table?.queries[0];

      expect(query?.conditions).toBe(
        `metric.name:browser.web_vital.${vital} metric.type:distribution`
      );
      expect(query?.aggregates).toEqual([]);
      expect(query?.fields).toEqual(
        expect.arrayContaining(['value', 'profile.id', 'replay.id'])
      );
    }
  });

  it('counts interactions with the INP metric', () => {
    const chart = widgets.find(widget => widget.id === 'interactions-chart');

    expect(chart?.widgetType).toBe(WidgetType.TRACEMETRICS);
    expect(chart?.queries[0]?.aggregates).toEqual([webVitalCountField('inp')]);
  });
});
