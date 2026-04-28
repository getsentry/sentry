import type {Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {MOBILE_VITALS_APP_STARTS_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/mobileVitals/appStarts';
import {MOBILE_VITALS_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/mobileVitals/mobileVitals';
import {MOBILE_VITALS_SCREEN_LOADS_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/mobileVitals/screenLoads';
import {MOBILE_VITALS_SCREEN_RENDERING_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/mobileVitals/screenRendering';
import {SpanFields} from 'sentry/views/insights/types';

const TRANSACTION_EVENT_COUNT = `count_unique(${SpanFields.TRANSACTION_EVENT_ID})`;

function getWidget(config: PrebuiltDashboard, id: string): Widget {
  const widget = config.widgets.find(item => item.id === id);

  if (!widget) {
    throw new Error(`Could not find widget "${id}"`);
  }

  return widget;
}

function getQuery(config: PrebuiltDashboard, id: string) {
  const query = getWidget(config, id).queries[0];

  if (!query) {
    throw new Error(`Could not find query for widget "${id}"`);
  }

  return query;
}

describe('mobile vitals prebuilt dashboards', () => {
  it('counts unique transaction events for overview transaction tables', () => {
    for (const widgetId of [
      'app-start-table',
      'screen-load-table',
      'screen-rendering-table',
    ]) {
      const query = getQuery(MOBILE_VITALS_PREBUILT_CONFIG, widgetId);

      expect(query.fields).toContain(TRANSACTION_EVENT_COUNT);
      expect(query.aggregates).toContain(TRANSACTION_EVENT_COUNT);
      expect(query.orderby).toBe(`-${TRANSACTION_EVENT_COUNT}`);
    }
  });

  it('scopes overview app start and screen load vitals to root transactions', () => {
    const appStartsQuery = getQuery(MOBILE_VITALS_PREBUILT_CONFIG, 'app-start-table');
    const screenLoadsQuery = getQuery(MOBILE_VITALS_PREBUILT_CONFIG, 'screen-load-table');

    expect(appStartsQuery.conditions).toContain(`${SpanFields.IS_TRANSACTION}:true`);
    expect(appStartsQuery.conditions).not.toContain(`${SpanFields.SPAN_OP}:app.start`);
    expect(screenLoadsQuery.conditions).toContain(`${SpanFields.IS_TRANSACTION}:true`);
    expect(screenLoadsQuery.conditions).not.toContain(
      `${SpanFields.SPAN_OP}:ui.load.initial_display`
    );
  });

  it('filters overview screen rendering metrics to root transactions with frame data', () => {
    for (const widgetId of [
      'slow-frame-rate-big-number',
      'frozen-frame-rate-big-number',
      'avg-frame-delay-big-number',
      'screen-rendering-table',
    ]) {
      const query = getQuery(MOBILE_VITALS_PREBUILT_CONFIG, widgetId);

      expect(query.conditions).toContain(`${SpanFields.IS_TRANSACTION}:true`);
      expect(query.conditions).toContain(
        `has:${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT}`
      );
    }
  });

  it('counts unique transaction events in app start count widgets', () => {
    for (const widgetId of [
      'total-cold-start-count-big-number',
      'total-warm-start-count-big-number',
    ]) {
      const query = getQuery(MOBILE_VITALS_APP_STARTS_PREBUILT_CONFIG, widgetId);

      expect(query.fields).toEqual([TRANSACTION_EVENT_COUNT]);
      expect(query.aggregates).toEqual([TRANSACTION_EVENT_COUNT]);
      expect(query.conditions).toContain(`${SpanFields.IS_TRANSACTION}:true`);
      expect(query.conditions).not.toContain(`${SpanFields.SPAN_OP}:app.start`);
    }
  });

  it('keeps screen load dashboard metrics scoped to root transactions', () => {
    for (const widgetId of ['total-count-big-number', 'total-count-line']) {
      const query = getQuery(MOBILE_VITALS_SCREEN_LOADS_PREBUILT_CONFIG, widgetId);

      expect(query.fields).toContain(TRANSACTION_EVENT_COUNT);
      expect(query.aggregates).toContain(TRANSACTION_EVENT_COUNT);
      expect(query.conditions).toContain(`${SpanFields.IS_TRANSACTION}:true`);
      expect(query.conditions).not.toContain(
        `${SpanFields.SPAN_OP}:ui.load.initial_display`
      );
    }
  });

  it('keeps the screen rendering sub-dashboard scoped to root transactions', () => {
    const query = getQuery(
      MOBILE_VITALS_SCREEN_RENDERING_PREBUILT_CONFIG,
      'span-operations-table'
    );

    expect(query.conditions).toContain(`${SpanFields.IS_TRANSACTION}:true`);
    expect(query.conditions).toContain(`has:${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT}`);
  });
});
