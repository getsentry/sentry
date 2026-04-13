import {getDetectorResponseErrorMessage} from 'sentry/views/detectors/components/forms/common/getDetectorResponseErrorMessage';

describe('getDetectorResponseErrorMessage', () => {
  it('returns undefined for undefined', () => {
    expect(getDetectorResponseErrorMessage(undefined)).toBeUndefined();
  });

  it('returns undefined for empty object', () => {
    expect(getDetectorResponseErrorMessage({})).toBeUndefined();
  });

  it('handles {detail: "message"} shape', () => {
    expect(getDetectorResponseErrorMessage({detail: 'Something went wrong'})).toBe(
      'Something went wrong'
    );
  });

  it('handles {field: ["message"]} shape', () => {
    expect(getDetectorResponseErrorMessage({name: ['Name is required']})).toBe(
      'Name is required'
    );
  });

  it('handles {dataSources: {field: ["message"]}} shape', () => {
    expect(
      getDetectorResponseErrorMessage({dataSources: {query: ['Invalid query']}})
    ).toBe('Invalid query');
  });

  it('returns the first message when multiple fields have errors', () => {
    const result = getDetectorResponseErrorMessage({
      name: ['Name error'],
      query: ['Query error'],
    });
    expect(result).toBe('Name error');
  });
});
