import {mergeEnvMappings} from './mergeEnvMappings';

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
      prod: {ok: 1, missed: 0, timeout: 0, error: 0},
    };
    const mergedMapping = mergeEnvMappings(envMappingA, envMappingB);

    expect(mergedMapping).toEqual(envMappingB);
  });

  it('merges two filled mappings', function () {
    const envMappingA = {
      prod: {ok: 0, missed: 1, timeout: 2, error: 1},
    };
    const envMappingB = {
      prod: {ok: 1, missed: 1, timeout: 0, error: 2},
    };
    const expectedMerged = {
      prod: {ok: 1, missed: 2, timeout: 2, error: 3},
    };
    const mergedMapping = mergeEnvMappings(envMappingA, envMappingB);

    expect(mergedMapping).toEqual(expectedMerged);
  });

  it('merges two filled mappings with differing envs', function () {
    const envMappingA = {
      prod: {ok: 0, missed: 1, timeout: 2, error: 1},
    };
    const envMappingB = {dev: {ok: 1, missed: 1, timeout: 0, error: 2}};
    const expectedMerged = {
      prod: {ok: 0, missed: 1, timeout: 2, error: 1},
      dev: {ok: 1, missed: 1, timeout: 0, error: 2},
    };
    const mergedMapping = mergeEnvMappings(envMappingA, envMappingB);

    expect(mergedMapping).toEqual(expectedMerged);
  });
});
