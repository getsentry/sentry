import {mapMetricUnitToFieldType} from 'sentry/views/explore/metrics/utils';

describe('mapMetricUnitToFieldType', () => {
  it('maps duration units', () => {
    expect(mapMetricUnitToFieldType('millisecond')).toEqual({
      fieldType: 'duration',
      unit: 'millisecond',
    });
    expect(mapMetricUnitToFieldType('nanosecond')).toEqual({
      fieldType: 'duration',
      unit: 'nanosecond',
    });
    expect(mapMetricUnitToFieldType('second')).toEqual({
      fieldType: 'duration',
      unit: 'second',
    });
    expect(mapMetricUnitToFieldType('minute')).toEqual({
      fieldType: 'duration',
      unit: 'minute',
    });
  });

  it('maps size units', () => {
    expect(mapMetricUnitToFieldType('byte')).toEqual({
      fieldType: 'size',
      unit: 'byte',
    });
    expect(mapMetricUnitToFieldType('kibibyte')).toEqual({
      fieldType: 'size',
      unit: 'kibibyte',
    });
    expect(mapMetricUnitToFieldType('megabyte')).toEqual({
      fieldType: 'size',
      unit: 'megabyte',
    });
  });

  it('maps percentage units', () => {
    expect(mapMetricUnitToFieldType('ratio')).toEqual({
      fieldType: 'percentage',
      unit: 'ratio',
    });
    expect(mapMetricUnitToFieldType('percent')).toEqual({
      fieldType: 'percentage',
      unit: 'percent',
    });
  });

  it('returns number for undefined unit', () => {
    expect(mapMetricUnitToFieldType(undefined)).toEqual({
      fieldType: 'number',
      unit: undefined,
    });
  });

  it('returns number for dash (unitless) unit', () => {
    expect(mapMetricUnitToFieldType('-')).toEqual({
      fieldType: 'number',
      unit: undefined,
    });
  });

  it('returns number for unknown unit strings', () => {
    expect(mapMetricUnitToFieldType('custom_unit')).toEqual({
      fieldType: 'number',
      unit: undefined,
    });
  });
});
