import {getStructuredDataConfig} from './getStructuredDataConfig';

describe('getStructuredDataConfig', () => {
  it('formats python values with sdk-specific conventions', () => {
    const config = getStructuredDataConfig({platform: 'python'});

    expect(config.isNull?.('None')).toBe(true);
    expect(config.isNull?.(null)).toBe(true);
    expect(config.renderNull?.(null)).toBe('None');

    expect(config.isBoolean?.('True')).toBe(true);
    expect(config.isBoolean?.(true)).toBe(true);
    expect(config.renderBoolean?.(true)).toBe('True');

    expect(config.isString?.("'string'")).toBe(true);
    expect(config.renderString?.("'string'")).toBe('string');

    expect(config.isNumber?.('123.45')).toBe(true);
    expect(config.isNumber?.(123.45)).toBe(true);
    expect(config.isNumber?.('<Class at 0x12345>')).toBe(false);
  });

  it('formats node sentinels for null and undefined', () => {
    const config = getStructuredDataConfig({platform: 'node'});

    expect(config.isNull?.('<null>')).toBe(true);
    expect(config.isNull?.('<undefined>')).toBe(true);
    expect(config.renderNull?.('<null>')).toBe('null');
    expect(config.renderNull?.('<undefined>')).toBe('undefined');
  });

  it('formats ruby null and booleans', () => {
    const config = getStructuredDataConfig({platform: 'ruby'});

    expect(config.isNull?.('nil')).toBe(true);
    expect(config.renderNull?.(null)).toBe('nil');
    expect(config.isBoolean?.('true')).toBe(true);
    expect(config.isBoolean?.(false)).toBe(true);
  });

  it('formats php null and booleans', () => {
    const config = getStructuredDataConfig({platform: 'php'});

    expect(config.isNull?.('null')).toBe(true);
    expect(config.isBoolean?.('true')).toBe(true);
    expect(config.isBoolean?.(true)).toBe(true);
  });

  it('returns an empty config for unsupported platforms', () => {
    expect(getStructuredDataConfig({platform: 'java'})).toEqual({});
  });
});
