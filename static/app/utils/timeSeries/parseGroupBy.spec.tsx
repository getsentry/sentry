import {parseGroupBy} from './parseGroupBy';

describe('parseGroupBy', () => {
  it('returns null for "Other" group name', () => {
    const result = parseGroupBy('Other', ['field1', 'field2']);
    expect(result).toBeNull();
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

  it('handles empty fields with some values', () => {
    const result = parseGroupBy('value1,value2,value3', []);
    expect(result).toBeNull();
  });

  it('handles some fields but empty value', () => {
    const result = parseGroupBy('', ['field1', 'field2']);
    expect(result).toEqual([
      {key: 'field1', value: ''},
      {key: 'field2', value: ''},
    ]);
  });

  it('handles one more value than field by concatenating', () => {
    const result = parseGroupBy('value1,value2,value3', ['field1', 'field2']);
    expect(result).toEqual([
      {key: 'field1', value: 'value1,value2'},
      {key: 'field2', value: 'value3'},
    ]);
  });

  it('handles many more values than fields by concatenating', () => {
    const result = parseGroupBy('value1,value2,value3', ['field1']);
    expect(result).toEqual([{key: 'field1', value: 'value1,value2,value3'}]);
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
    expect(result).toBeNull();
  });
});
