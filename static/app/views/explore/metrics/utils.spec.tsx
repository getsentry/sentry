import {mapMetricUnitToFieldType} from 'sentry/views/explore/metrics/utils';

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
// trivial change for CI testing
