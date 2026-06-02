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
    expect(DEFAULT_TRACE_VIEW_PREFERENCES.compressedTimeline).toBe(true);
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
      }).compressedTimeline
    ).toBe(true);
  });

  it('loads legacy snake case compressed timeline preferences', () => {
    localStorage.setItem(
      'trace-waterfall-preferences',
      JSON.stringify({
        drawer_layout: DEFAULT_TRACE_VIEW_PREFERENCES.layout,
        missing_instrumentation: false,
        autogroup: {parent: true, sibling: true},
        compressed_timeline: false,
      })
    );

    expect(
      getInitialTracePreferences('trace-waterfall-preferences', {
        ...DEFAULT_TRACE_VIEW_PREFERENCES,
      }).compressedTimeline
    ).toBe(false);
  });

  it('updates compressed timeline preference', () => {
    expect(
      tracePreferencesReducer(DEFAULT_TRACE_VIEW_PREFERENCES, {
        type: 'set compressed timeline',
        payload: false,
      }).compressedTimeline
    ).toBe(false);
  });
});
