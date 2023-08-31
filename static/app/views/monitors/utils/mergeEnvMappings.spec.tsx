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
      prod: {in_progress: 0, ok: 1, missed: 0, timeout: 0, error: 0},
    };
    const mergedMapping = mergeEnvMappings(envMappingA, envMappingB);

    expect(mergedMapping).toEqual(envMappingB);
  });

  it('merges two filled mappings', function () {
    const envMappingA = {
      prod: {in_progress: 0, ok: 0, missed: 1, timeout: 2, error: 1},
    };
    const envMappingB = {
      prod: {in_progress: 2, ok: 1, missed: 1, timeout: 0, error: 2},
    };
    const expectedMerged = {
      prod: {in_progress: 2, ok: 1, missed: 2, timeout: 2, error: 3},
    };
    const mergedMapping = mergeEnvMappings(envMappingA, envMappingB);

    expect(mergedMapping).toEqual(expectedMerged);
  });

  it('merges two filled mappings with differing envs', function () {
    const envMappingA = {
      prod: {in_progress: 1, ok: 0, missed: 1, timeout: 2, error: 1},
    };
    const envMappingB = {dev: {in_progress: 0, ok: 1, missed: 1, timeout: 0, error: 2}};
    const expectedMerged = {
      prod: {in_progress: 1, ok: 0, missed: 1, timeout: 2, error: 1},
      dev: {in_progress: 0, ok: 1, missed: 1, timeout: 0, error: 2},
    };
    const mergedMapping = mergeEnvMappings(envMappingA, envMappingB);

    expect(mergedMapping).toEqual(expectedMerged);
  });
});
