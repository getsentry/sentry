import {getAttributeSearchMetadataKey} from 'sentry/utils/fields/getAttributeSearchMetadataKey';

describe('getAttributeSearchMetadataKey', () => {
  it('returns the canonical metadata key', () => {
    expect(getAttributeSearchMetadataKey('http.request.method')).toBe(
      'http.request.method'
    );
  });

  it('returns the canonical metadata key for a deprecated key', () => {
    expect(getAttributeSearchMetadataKey('http.method')).toBe('http.request.method');
  });

  it('unwraps typed tag keys', () => {
    expect(getAttributeSearchMetadataKey('tags[http.method,string]')).toBe(
      'http.request.method'
    );
  });

  it('returns the requested key when it has no search metadata', () => {
    expect(getAttributeSearchMetadataKey('tags[unknown.attribute,string]')).toBe(
      'tags[unknown.attribute,string]'
    );
    expect(getAttributeSearchMetadataKey('unknown.attribute')).toBe('unknown.attribute');
  });
});
