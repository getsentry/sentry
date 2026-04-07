import {DisplayType} from 'sentry/views/dashboards/types';

import {getWidgetQueryLLMHint} from './widgetLLMContext';

describe('getWidgetQueryLLMHint', () => {
  it.each([
    [DisplayType.LINE, 'timeseries'],
    [DisplayType.AREA, 'timeseries'],
    [DisplayType.BAR, 'timeseries'],
  ])('returns timeseries hint for %s', (displayType, expected) => {
    expect(getWidgetQueryLLMHint(displayType)).toContain(expected);
  });

  it('returns table hint for TABLE', () => {
    expect(getWidgetQueryLLMHint(DisplayType.TABLE)).toContain('table query');
  });

  it('returns single aggregate hint for BIG_NUMBER', () => {
    expect(getWidgetQueryLLMHint(DisplayType.BIG_NUMBER)).toContain('single aggregate');
    expect(getWidgetQueryLLMHint(DisplayType.BIG_NUMBER)).toContain(
      'value is included below'
    );
  });

  it('returns table hint as default for unknown types', () => {
    expect(getWidgetQueryLLMHint(DisplayType.WHEEL)).toContain('table query');
  });
});
