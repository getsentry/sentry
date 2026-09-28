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

  it('uses the main trace compressed timeline default when stored preferences omit it', () => {
    localStorage.setItem(
      'trace-waterfall-preferences',
      JSON.stringify({
        drawer_layout: DEFAULT_TRACE_VIEW_PREFERENCES.layout,
        missing_instrumentation: false,
        autogroup: {parent: true, sibling: true},
      })
    );

    expect(
      getInitialTracePreferences(
        'trace-waterfall-preferences',
        {
          ...DEFAULT_TRACE_VIEW_PREFERENCES,
        },
        'trace_view'
      ).compressed_timeline
    ).toBe(true);
  });

  it('uses the provided compressed timeline default when stored preferences omit it', () => {
    localStorage.setItem(
      'trace-waterfall-preferences',
      JSON.stringify({
        drawer_layout: DEFAULT_TRACE_VIEW_PREFERENCES.layout,
        missing_instrumentation: false,
        autogroup: {parent: true, sibling: true},
      })
    );

    expect(
      getInitialTracePreferences(
        'trace-waterfall-preferences',
        {
          ...DEFAULT_TRACE_VIEW_PREFERENCES,
          compressed_timeline: false,
        },
        'trace_view'
      ).compressed_timeline
    ).toBe(false);
  });

  it('loads stored compressed timeline preferences', () => {
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
      getInitialTracePreferences(
        'trace-waterfall-preferences',
        {
          ...DEFAULT_TRACE_VIEW_PREFERENCES,
        },
        'trace_view'
      ).compressed_timeline
    ).toBe(false);
  });

  it('uses the stored snake_case compressed timeline value over the provided default', () => {
    localStorage.setItem(
      'trace-waterfall-preferences',
      JSON.stringify({
        drawer_layout: DEFAULT_TRACE_VIEW_PREFERENCES.layout,
        missing_instrumentation: false,
        autogroup: {parent: true, sibling: true},
        compressed_timeline: true,
      })
    );

    expect(
      getInitialTracePreferences(
        'trace-waterfall-preferences',
        {
          ...DEFAULT_TRACE_VIEW_PREFERENCES,
          compressed_timeline: false,
        },
        'trace_view'
      ).compressed_timeline
    ).toBe(true);
  });

  it('keeps compressed timeline disabled when the feature is not enabled', () => {
    localStorage.setItem(
      'trace-waterfall-preferences',
      JSON.stringify({
        drawer_layout: DEFAULT_TRACE_VIEW_PREFERENCES.layout,
        missing_instrumentation: false,
        autogroup: {parent: true, sibling: true},
        compressed_timeline: true,
      })
    );

    expect(
      getInitialTracePreferences(
        'trace-waterfall-preferences',
        {
          ...DEFAULT_TRACE_VIEW_PREFERENCES,
        },
        'trace_view',
        {enableCompressedTimeline: false}
      ).compressed_timeline
    ).toBe(false);
  });

  it('defaults compressed timeline off when the feature is not enabled', () => {
    expect(
      getInitialTracePreferences(
        'trace-waterfall-preferences',
        {
          ...DEFAULT_TRACE_VIEW_PREFERENCES,
        },
        'trace_view',
        {enableCompressedTimeline: false}
      ).compressed_timeline
    ).toBe(false);
  });

  it('uses the provided compressed timeline default when the stored value is invalid', () => {
    localStorage.setItem(
      'trace-waterfall-preferences',
      JSON.stringify({
        drawer_layout: DEFAULT_TRACE_VIEW_PREFERENCES.layout,
        missing_instrumentation: false,
        autogroup: {parent: true, sibling: true},
        compressed_timeline: 'true',
      })
    );

    expect(
      getInitialTracePreferences(
        'trace-waterfall-preferences',
        {
          ...DEFAULT_TRACE_VIEW_PREFERENCES,
          compressed_timeline: false,
        },
        'trace_view'
      ).compressed_timeline
    ).toBe(false);
  });

  it('keeps compressed timeline disabled for issue and replay traces', () => {
    localStorage.setItem(
      'trace-waterfall-preferences',
      JSON.stringify({
        drawer_layout: DEFAULT_TRACE_VIEW_PREFERENCES.layout,
        missing_instrumentation: false,
        autogroup: {parent: true, sibling: true},
        compressed_timeline: true,
      })
    );

    expect(
      getInitialTracePreferences(
        'trace-waterfall-preferences',
        {
          ...DEFAULT_TRACE_VIEW_PREFERENCES,
        },
        'issues'
      ).compressed_timeline
    ).toBe(false);

    expect(
      getInitialTracePreferences(
        'trace-waterfall-preferences',
        {
          ...DEFAULT_TRACE_VIEW_PREFERENCES,
        },
        'replay'
      ).compressed_timeline
    ).toBe(false);
  });

  it('updates compressed timeline preference', () => {
    expect(
      tracePreferencesReducer(DEFAULT_TRACE_VIEW_PREFERENCES, {
        type: 'set compressed timeline',
        payload: false,
      }).compressed_timeline
    ).toBe(false);
  });

  it('does not mutate the provided default state when stored preferences load', () => {
    const defaultState = {
      ...DEFAULT_TRACE_VIEW_PREFERENCES,
      compressed_timeline: false,
    };

    localStorage.setItem(
      'trace-waterfall-preferences',
      JSON.stringify({
        drawer_layout: 'drawer bottom',
        missing_instrumentation: true,
        autogroup: {parent: false, sibling: false},
        compressed_timeline: true,
      })
    );

    const preferences = getInitialTracePreferences(
      'trace-waterfall-preferences',
      defaultState,
      'trace_view'
    );

    expect(preferences.compressed_timeline).toBe(true);
    expect(preferences.layout).toBe('drawer bottom');
    expect(defaultState.compressed_timeline).toBe(false);
    expect(defaultState.layout).toBe(DEFAULT_TRACE_VIEW_PREFERENCES.layout);
  });
});
