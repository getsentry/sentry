import type {Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {MOBILE_VITALS_APP_STARTS_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/mobileVitals/appStarts';
import {MOBILE_VITALS_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/mobileVitals/mobileVitals';
import {MOBILE_VITALS_SCREEN_LOADS_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/mobileVitals/screenLoads';
import {MOBILE_VITALS_SCREEN_RENDERING_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/mobileVitals/screenRendering';
import {SpanFields} from 'sentry/views/insights/types';

const TRANSACTION_COUNT = `count_unique(${SpanFields.TRANSACTION_SPAN_ID})`;

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
  it('counts unique transaction spans for overview transaction tables', () => {
    for (const widgetId of [
      'app-start-table',
      'screen-load-table',
      'screen-rendering-table',
    ]) {
      const query = getQuery(MOBILE_VITALS_PREBUILT_CONFIG, widgetId);

      expect(query.fields).toContain(TRANSACTION_COUNT);
      expect(query.aggregates).toContain(TRANSACTION_COUNT);
      expect(query.orderby).toBe(`-${TRANSACTION_COUNT}`);
    }
  });

  it('supports v1 root transactions and v2 standalone spans in overview vitals', () => {
    const appStartsQuery = getQuery(MOBILE_VITALS_PREBUILT_CONFIG, 'app-start-table');
    const screenLoadsQuery = getQuery(MOBILE_VITALS_PREBUILT_CONFIG, 'screen-load-table');

    expect(appStartsQuery.conditions).toContain(`${SpanFields.IS_TRANSACTION}:true`);
    expect(appStartsQuery.conditions).toContain(`${SpanFields.SPAN_OP}:app.start.cold`);
    expect(appStartsQuery.conditions).toContain(`${SpanFields.SPAN_OP}:app.start.warm`);
    expect(appStartsQuery.conditions).toContain(`has:${SpanFields.TRANSACTION}`);
    expect(screenLoadsQuery.conditions).toContain(`${SpanFields.IS_TRANSACTION}:true`);
    expect(screenLoadsQuery.conditions).toContain(
      `${SpanFields.SPAN_OP}:ui.load.initial_display`
    );
    expect(screenLoadsQuery.conditions).toContain(
      `${SpanFields.SPAN_OP}:ui.load.full_display`
    );
    expect(screenLoadsQuery.conditions).toContain(`has:${SpanFields.TRANSACTION}`);
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
      if (widgetId === 'screen-rendering-table') {
        expect(query.conditions).toContain(`has:${SpanFields.TRANSACTION}`);
      }
    }
  });

  it('counts unique transaction spans in app start count widgets', () => {
    for (const widgetId of [
      'total-cold-start-count-big-number',
      'total-warm-start-count-big-number',
    ]) {
      const query = getQuery(MOBILE_VITALS_APP_STARTS_PREBUILT_CONFIG, widgetId);
      const expectedSpanOp =
        widgetId === 'total-cold-start-count-big-number'
          ? 'app.start.cold'
          : 'app.start.warm';

      expect(query.fields).toEqual([TRANSACTION_COUNT]);
      expect(query.aggregates).toEqual([TRANSACTION_COUNT]);
      expect(query.conditions).toContain(`${SpanFields.IS_TRANSACTION}:true`);
      expect(query.conditions).toContain(`${SpanFields.SPAN_OP}:${expectedSpanOp}`);
    }
  });

  it('supports v1 root transactions and v2 standalone spans in screen load metrics', () => {
    for (const widgetId of ['total-count-big-number', 'total-count-line']) {
      const query = getQuery(MOBILE_VITALS_SCREEN_LOADS_PREBUILT_CONFIG, widgetId);

      expect(query.fields).toContain(TRANSACTION_COUNT);
      expect(query.aggregates).toContain(TRANSACTION_COUNT);
      expect(query.conditions).toContain(`${SpanFields.IS_TRANSACTION}:true`);
      expect(query.conditions).toContain(`${SpanFields.SPAN_OP}:ui.load.initial_display`);
      expect(query.conditions).toContain(`${SpanFields.SPAN_OP}:ui.load.full_display`);
    }
  });

  it('keeps the screen rendering sub-dashboard scoped to root transactions', () => {
    const query = getQuery(
      MOBILE_VITALS_SCREEN_RENDERING_PREBUILT_CONFIG,
      'span-operations-table'
    );

    expect(query.conditions).toContain(`${SpanFields.IS_TRANSACTION}:true`);
    expect(query.conditions).toContain(`has:${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT}`);
    expect(query.conditions).toContain(`has:${SpanFields.TRANSACTION}`);
  });

  it('supports span v1 descriptions and span v2 names in operations tables', () => {
    for (const [config, widgetId] of [
      [MOBILE_VITALS_APP_STARTS_PREBUILT_CONFIG, 'cold-operations-table'],
      [MOBILE_VITALS_APP_STARTS_PREBUILT_CONFIG, 'warm-operations-table'],
      [MOBILE_VITALS_SCREEN_LOADS_PREBUILT_CONFIG, 'span-operations-table'],
    ] as const) {
      const query = getQuery(config, widgetId);

      expect(query.columns).toEqual(
        expect.arrayContaining([SpanFields.NAME, SpanFields.SPAN_DESCRIPTION])
      );
      expect(query.conditions).toContain(`has:${SpanFields.SPAN_DESCRIPTION}`);
      expect(query.conditions).toContain(`has:${SpanFields.NAME}`);
    }
  });

  it('splits app start operations by canonical app.vitals start type', () => {
    const coldQuery = getQuery(
      MOBILE_VITALS_APP_STARTS_PREBUILT_CONFIG,
      'cold-operations-table'
    );
    const warmQuery = getQuery(
      MOBILE_VITALS_APP_STARTS_PREBUILT_CONFIG,
      'warm-operations-table'
    );

    expect(coldQuery.conditions).toContain(`${SpanFields.APP_START_TYPE}:cold`);
    expect(coldQuery.conditions).toContain(`${SpanFields.APP_VITALS_START_TYPE}:cold`);
    expect(coldQuery.conditions).toContain('has:ttid');
    expect(coldQuery.conditions).toContain(`!${SpanFields.IS_TRANSACTION}:true`);
    expect(coldQuery.conditions).toContain(`${SpanFields.TRANSACTION_OP}:`);
    expect(warmQuery.conditions).toContain(`${SpanFields.APP_START_TYPE}:warm`);
    expect(warmQuery.conditions).toContain(`${SpanFields.APP_VITALS_START_TYPE}:warm`);
    expect(warmQuery.conditions).toContain('has:ttid');
    expect(warmQuery.conditions).toContain(`!${SpanFields.IS_TRANSACTION}:true`);
    expect(warmQuery.conditions).toContain(`${SpanFields.TRANSACTION_OP}:`);
  });
});
