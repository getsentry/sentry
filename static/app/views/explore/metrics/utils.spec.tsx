import {
  mapMetricUnitToFieldType,
  getTracePeriodFromSelection,
} from 'sentry/views/explore/metrics/utils';

describe('mapMetricUnitToFieldType', () => {
  it.each([
    ['millisecond', {fieldType: 'duration', unit: 'millisecond'}],
    ['nanosecond', {fieldType: 'duration', unit: 'nanosecond'}],
    ['second', {fieldType: 'duration', unit: 'second'}],
    ['minute', {fieldType: 'duration', unit: 'minute'}],
    ['byte', {fieldType: 'size', unit: 'byte'}],
    ['kibibyte', {fieldType: 'size', unit: 'kibibyte'}],
    ['megabyte', {fieldType: 'size', unit: 'megabyte'}],
    ['ratio', {fieldType: 'percentage', unit: 'ratio'}],
    ['percent', {fieldType: 'percentage', unit: 'percent'}],
    [undefined, {fieldType: 'number', unit: undefined}],
    ['-', {fieldType: 'number', unit: undefined}],
    ['custom_unit', {fieldType: 'number', unit: undefined}],
  ])('maps %s to the correct field type', (unit, expected) => {
    expect(mapMetricUnitToFieldType(unit)).toEqual(expected);
  });
});

describe('getTracePeriodFromSelection', () => {
  it('rounds the selected range to minute boundaries', () => {
    expect(
      getTracePeriodFromSelection({
        panelId: 'panel-id',
        range: [
          Date.UTC(2025, 2, 24, 18, 31, 52, 345),
          Date.UTC(2025, 2, 24, 18, 34, 59, 999),
        ],
      })
    ).toEqual({
      start: '2025-03-24T18:31:00',
      end: '2025-03-24T18:35:00',
      period: null,
    });
  });

  it('ensures the selected range spans at least one minute', () => {
    expect(
      getTracePeriodFromSelection({
        panelId: 'panel-id',
        range: [Date.UTC(2025, 2, 24, 18, 24, 1, 0), Date.UTC(2025, 2, 24, 18, 24, 2, 0)],
      })
    ).toEqual({
      start: '2025-03-24T18:24:00',
      end: '2025-03-24T18:25:00',
      period: null,
    });
  });
});
