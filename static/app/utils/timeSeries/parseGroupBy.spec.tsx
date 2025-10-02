import {parseGroupBy} from './parseGroupBy';

describe('parseGroupBy', () => {
  it('returns undefined for "Other" group name', () => {
    const result = parseGroupBy('Other', ['field1', 'field2']);
    expect(result).toBeUndefined();
  });

  it('parses single field and value correctly', () => {
    const result = parseGroupBy('value1', ['field1']);
    expect(result).toEqual([{key: 'field1', value: 'value1'}]);
  });

  it('parses multiple fields and values correctly', () => {
    const result = parseGroupBy('value1,value2,value3', ['field1', 'field2', 'field3']);
    expect(result).toEqual([
      {key: 'field1', value: 'value1'},
      {key: 'field2', value: 'value2'},
      {key: 'field3', value: 'value3'},
    ]);
  });

  it('handles more values than fields by using empty strings for extra values', () => {
    const result = parseGroupBy('value1,value2', ['field1']);
    expect(result).toEqual([
      {key: 'field1', value: 'value1'},
      {key: '', value: 'value2'},
    ]);
  });

  it('handles more fields than values by using empty strings for missing values', () => {
    const result = parseGroupBy('value1', ['field1', 'field2']);
    expect(result).toEqual([
      {key: 'field1', value: 'value1'},
      {key: 'field2', value: ''},
    ]);
  });

  it('handles empty strings in values', () => {
    const result = parseGroupBy('value1,,value3', ['field1', 'field2', 'field3']);
    expect(result).toEqual([
      {key: 'field1', value: 'value1'},
      {key: 'field2', value: ''},
      {key: 'field3', value: 'value3'},
    ]);
  });

  it('handles empty fields array', () => {
    const result = parseGroupBy('', []);
    expect(result).toBeUndefined();
  });
});
