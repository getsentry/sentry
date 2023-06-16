import {
  isEnvMappingEmpty,
  mergeEnvMappings,
} from 'sentry/views/monitors/components/overviewTimeline/utils';

describe('Crons Timeline Utils', function () {
  describe('isEnvMappingEmpty', function () {
    it('returns true for an empty env', function () {
      const envMapping = {};
      expect(isEnvMappingEmpty(envMapping)).toEqual(true);
    });

    it('returns false for a filled env', function () {
      const envMapping = {prod: {ok: 1, missed: 0, timeout: 0, error: 0, in_progress: 0}};
      expect(isEnvMappingEmpty(envMapping)).toEqual(false);
    });
  });

  describe('mergeEnvMappings', function () {
    it('merges two empty mappings', function () {
      const envMappingA = {};
      const envMappingB = {};
      const mergedMapping = mergeEnvMappings(envMappingA, envMappingB);

      expect(mergedMapping).toEqual({});
    });

    it('merges one empty mapping with one filled mapping', function () {
      const envMappingA = {};
      const envMappingB = {
        prod: {ok: 1, missed: 0, timeout: 0, error: 0, in_progress: 0},
      };
      const mergedMapping = mergeEnvMappings(envMappingA, envMappingB);

      expect(mergedMapping).toEqual(envMappingB);
    });

    it('merges two filled mappings', function () {
      const envMappingA = {
        prod: {ok: 0, missed: 1, timeout: 2, error: 1, in_progress: 0},
      };
      const envMappingB = {
        prod: {ok: 1, missed: 1, timeout: 0, error: 2, in_progress: 3},
      };
      const expectedMerged = {
        prod: {ok: 1, missed: 2, timeout: 2, error: 3, in_progress: 3},
      };
      const mergedMapping = mergeEnvMappings(envMappingA, envMappingB);

      expect(mergedMapping).toEqual(expectedMerged);
    });

    it('merges two filled mappings with differing envs', function () {
      const envMappingA = {
        prod: {ok: 0, missed: 1, timeout: 2, error: 1, in_progress: 0},
      };
      const envMappingB = {dev: {ok: 1, missed: 1, timeout: 0, error: 2, in_progress: 3}};
      const expectedMerged = {
        prod: {ok: 0, missed: 1, timeout: 2, error: 1, in_progress: 0},
        dev: {ok: 1, missed: 1, timeout: 0, error: 2, in_progress: 3},
      };
      const mergedMapping = mergeEnvMappings(envMappingA, envMappingB);

      expect(mergedMapping).toEqual(expectedMerged);
    });
  });
});
