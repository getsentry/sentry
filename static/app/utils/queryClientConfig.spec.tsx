import {RequestError} from './requestError/requestError';
import {DEFAULT_QUERY_CLIENT_CONFIG} from './queryClientConfig';

describe('queryClientConfig', () => {
  describe('default retry', () => {
    const retry = DEFAULT_QUERY_CLIENT_CONFIG.defaultOptions?.queries?.retry as (
      failureCount: number,
      error: Error
    ) => boolean;

    const errorWithStatus = (status: number) => {
      const err = new RequestError('GET', '/x/', new Error('request failed'));
      err.status = status;
      return err;
    };

    it.each([400, 401, 402, 403, 404])('does not retry on %s status', status => {
      expect(retry(0, errorWithStatus(status))).toBe(false);
    });

    it.each([
      [0, true],
      [2, true],
      [3, false],
    ])('retries other errors when failureCount is %i', (failureCount, expected) => {
      expect(retry(failureCount, errorWithStatus(500))).toBe(expected);
    });
  });
});
