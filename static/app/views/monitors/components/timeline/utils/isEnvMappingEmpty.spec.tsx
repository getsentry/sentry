import {isEnvMappingEmpty} from './isEnvMappingEmpty';

describe('isEnvMappingEmpty', function () {
  it('returns true for an empty env', function () {
    const envMapping = {};
    expect(isEnvMappingEmpty(envMapping)).toBe(true);
  });

  it('returns false for a filled env', function () {
    const envMapping = {
      prod: {ok: 1, missed: 0, timeout: 0, error: 0, in_progress: 0, unknown: 0},
    };
    expect(isEnvMappingEmpty(envMapping)).toBe(false);
  });
});
