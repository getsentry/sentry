import {WidgetFixture} from 'sentry-fixture/widget';

import {DisplayType} from 'sentry/views/dashboards/types';

import {
  getQueryHintLegend,
  getWidgetQueryLLMHint,
  readableConditions,
} from './widgetLLMContext';

describe('getWidgetQueryLLMHint', () => {
  it.each([
    [DisplayType.LINE, 'timeseries chart'],
    [DisplayType.AREA, 'timeseries chart'],
    [DisplayType.BAR, 'timeseries chart'],
  ])('returns timeseries hint for %s', (displayType, expected) => {
    expect(getWidgetQueryLLMHint(displayType)).toContain(expected);
  });

  it('returns table hint for TABLE', () => {
    expect(getWidgetQueryLLMHint(DisplayType.TABLE)).toContain('shows a table');
  });

  it('returns single number hint for BIG_NUMBER', () => {
    expect(getWidgetQueryLLMHint(DisplayType.BIG_NUMBER)).toContain('single number');
    expect(getWidgetQueryLLMHint(DisplayType.BIG_NUMBER)).toContain(
      'current value is included in each widget'
    );
  });

  it('returns generic hint for unknown types', () => {
    expect(getWidgetQueryLLMHint(DisplayType.WHEEL)).toContain('shows data');
  });
});

describe('getQueryHintLegend', () => {
  it('returns hints keyed by display type', () => {
    const widgets = [
      WidgetFixture({displayType: DisplayType.BAR}),
      WidgetFixture({displayType: DisplayType.BIG_NUMBER}),
    ];
    const legend = getQueryHintLegend(widgets);
    expect(Object.keys(legend)).toEqual(
      expect.arrayContaining([DisplayType.BAR, DisplayType.BIG_NUMBER])
    );
    expect(Object.keys(legend)).toHaveLength(2);
  });

  it('only includes display types present in the widget list', () => {
    const widgets = [WidgetFixture({displayType: DisplayType.TABLE})];
    const legend = getQueryHintLegend(widgets);
    expect(Object.keys(legend)).toEqual([DisplayType.TABLE]);
  });

  it('deduplicates multiple widgets of the same type', () => {
    const widgets = [
      WidgetFixture({displayType: DisplayType.BAR}),
      WidgetFixture({displayType: DisplayType.BAR}),
      WidgetFixture({displayType: DisplayType.BAR}),
    ];
    const legend = getQueryHintLegend(widgets);
    expect(Object.keys(legend)).toEqual([DisplayType.BAR]);
  });

  it('resolves TOP_N to AREA', () => {
    const widgets = [WidgetFixture({displayType: DisplayType.TOP_N})];
    const legend = getQueryHintLegend(widgets);
    expect(Object.keys(legend)).toEqual([DisplayType.AREA]);
    expect(legend[DisplayType.AREA]).toContain('timeseries chart');
  });
});

describe('readableConditions', () => {
  it('replaces Contains operator with readable label', () => {
    expect(readableConditions('span.name:\uf00dContains\uf00dfoo')).toBe(
      'span.name: contains foo'
    );
  });

  it('replaces Contains with IN list brackets', () => {
    expect(readableConditions('span.name:\uf00dContains\uf00d[a,b,c]')).toBe(
      'span.name: contains [a,b,c]'
    );
  });

  it('replaces DoesNotContain operator', () => {
    expect(readableConditions('key:\uf00dDoesNotContain\uf00dval')).toBe(
      'key: does not contain val'
    );
  });

  it('replaces StartsWith and EndsWith operators', () => {
    expect(readableConditions('key:\uf00dStartsWith\uf00d/api')).toBe(
      'key: starts with /api'
    );
    expect(readableConditions('key:\uf00dEndsWith\uf00d.json')).toBe(
      'key: ends with .json'
    );
  });

  it('replaces DoesNotStartWith and DoesNotEndWith operators', () => {
    expect(readableConditions('key:\uf00dDoesNotStartWith\uf00d/api')).toBe(
      'key: does not start with /api'
    );
    expect(readableConditions('key:\uf00dDoesNotEndWith\uf00d.json')).toBe(
      'key: does not end with .json'
    );
  });

  it('preserves negated filter prefix', () => {
    expect(readableConditions('!path:\uf00dContains\uf00dfoo')).toBe(
      '!path: contains foo'
    );
  });

  it('replaces multiple operators in one string', () => {
    const input =
      'span.name:\uf00dContains\uf00dqueue.task !trigger_path:\uf00dContains\uf00dold_seer';
    expect(readableConditions(input)).toBe(
      'span.name: contains queue.task !trigger_path: contains old_seer'
    );
  });

  it('passes through plain filters unchanged', () => {
    expect(readableConditions('browser.name:Firefox')).toBe('browser.name:Firefox');
  });

  it('passes through free text unchanged', () => {
    expect(readableConditions('some free text')).toBe('some free text');
  });

  it('passes through empty string', () => {
    expect(readableConditions('')).toBe('');
  });

  it('preserves OR and parentheses', () => {
    expect(readableConditions('(a:1 OR b:2) error')).toBe('(a:1 OR b:2) error');
  });

  it('preserves comparison operators', () => {
    expect(readableConditions('count():>100 duration:<=5s')).toBe(
      'count():>100 duration:<=5s'
    );
  });

  it('handles real-world widget query', () => {
    const input =
      'span.description:\uf00dContains\uf00d[sentry.tasks.autofix.generate_issue_summary_only,sentry.tasks.autofix.run_automation_only_task] span.name:\uf00dContains\uf00dqueue.task.taskworker !trigger_path:\uf00dContains\uf00dold_seer_automation';
    expect(readableConditions(input)).toBe(
      'span.description: contains [sentry.tasks.autofix.generate_issue_summary_only,sentry.tasks.autofix.run_automation_only_task] span.name: contains queue.task.taskworker !trigger_path: contains old_seer_automation'
    );
  });

  it('does not replace DoesNotContain partially as Contains', () => {
    // DoesNotContain must be replaced before Contains to avoid partial match
    expect(readableConditions('key:\uf00dDoesNotContain\uf00dval')).toBe(
      'key: does not contain val'
    );
    // Should NOT produce "key: does not contains val" or "key:DoesNot contains val"
    expect(readableConditions('key:\uf00dDoesNotContain\uf00dval')).not.toContain(
      '\uf00d'
    );
  });

  it('handles mixed operator types in one query', () => {
    const input =
      'url:\uf00dStartsWith\uf00d/api span.description:\uf00dContains\uf00dfoo !path:\uf00dDoesNotEndWith\uf00d.js';
    expect(readableConditions(input)).toBe(
      'url: starts with /api span.description: contains foo !path: does not end with .js'
    );
  });

  it('handles the same operator appearing multiple times', () => {
    const input =
      'a:\uf00dContains\uf00dfoo b:\uf00dContains\uf00dbar c:\uf00dContains\uf00dbaz';
    expect(readableConditions(input)).toBe(
      'a: contains foo b: contains bar c: contains baz'
    );
  });

  it('preserves OR with wildcard operators inside parens', () => {
    const input =
      '(span.name:\uf00dContains\uf00dfoo OR span.name:\uf00dContains\uf00dbar)';
    expect(readableConditions(input)).toBe(
      '(span.name: contains foo OR span.name: contains bar)'
    );
  });

  it('does not replace literal "Contains" text without unicode markers', () => {
    // The word "Contains" in a value or free text should NOT be replaced
    expect(readableConditions('message:Contains error')).toBe('message:Contains error');
  });
});
