import {
  DEFAULT_TRACE_VIEW_PREFERENCES,
  getInitialTracePreferences,
  tracePreferencesReducer,
} from './tracePreferences';

describe('tracePreferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults compressed timeline on', () => {
    expect(DEFAULT_TRACE_VIEW_PREFERENCES.compressed_timeline).toBe(true);
  });

  it('backfills compressed timeline for stored preferences', () => {
    localStorage.setItem(
      'trace-waterfall-preferences',
      JSON.stringify({
        drawer_layout: DEFAULT_TRACE_VIEW_PREFERENCES.layout,
        missing_instrumentation: false,
        autogroup: {parent: true, sibling: true},
      })
    );

    expect(
      getInitialTracePreferences('trace-waterfall-preferences', {
        ...DEFAULT_TRACE_VIEW_PREFERENCES,
      }).compressed_timeline
    ).toBe(true);
  });

  it('updates compressed timeline preference', () => {
    expect(
      tracePreferencesReducer(DEFAULT_TRACE_VIEW_PREFERENCES, {
        type: 'set compressed timeline',
        payload: false,
      }).compressed_timeline
    ).toBe(false);
  });
});
