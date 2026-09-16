import {
  expandSnapshotScenarios,
  getSnapshotFeaturesTag,
  normalizeSnapshotFeatures,
} from './snapshotScenarios';

describe('expandSnapshotScenarios', () => {
  it('expands a logical snapshot into stable light and dark test names', () => {
    expect(expandSnapshotScenarios('default')).toEqual([
      {
        theme: 'light',
        container: '3xl',
        containerWidth: 1024,
        features: [],
        testName: 'light snapshot: default',
      },
      {
        theme: 'dark',
        container: '3xl',
        containerWidth: 1024,
        features: [],
        testName: 'dark snapshot: default',
      },
    ]);
  });

  it('keeps the viewport suffix stable across themes', () => {
    expect(expandSnapshotScenarios('default', ['3xl'], 'md')).toEqual([
      {
        theme: 'light',
        container: '3xl',
        containerWidth: 1024,
        features: [],
        testName: 'light snapshot: default @md',
      },
      {
        theme: 'dark',
        container: '3xl',
        containerWidth: 1024,
        features: [],
        testName: 'dark snapshot: default @md',
      },
    ]);
  });

  it('crosses declared containers with themes using stable token suffixes', () => {
    expect(expandSnapshotScenarios('responsive', ['xs', '2xl'])).toEqual([
      {
        theme: 'light',
        container: 'xs',
        containerWidth: 448,
        features: [],
        testName: 'light snapshot: responsive @container-xs',
      },
      {
        theme: 'light',
        container: '2xl',
        containerWidth: 896,
        features: [],
        testName: 'light snapshot: responsive @container-2xl',
      },
      {
        theme: 'dark',
        container: 'xs',
        containerWidth: 448,
        features: [],
        testName: 'dark snapshot: responsive @container-xs',
      },
      {
        theme: 'dark',
        container: '2xl',
        containerWidth: 896,
        features: [],
        testName: 'dark snapshot: responsive @container-2xl',
      },
    ]);
  });

  it('normalizes features to the exact sorted and deduplicated set', () => {
    const features = normalizeSnapshotFeatures([
      'session-replay',
      'discover-basic',
      'session-replay',
    ]);

    expect(features).toEqual(['discover-basic', 'session-replay']);
    expect(expandSnapshotScenarios('features', ['3xl'], undefined, features)).toEqual([
      {
        theme: 'light',
        container: '3xl',
        containerWidth: 1024,
        features: ['discover-basic', 'session-replay'],
        testName: 'light snapshot: features',
      },
      {
        theme: 'dark',
        container: '3xl',
        containerWidth: 1024,
        features: ['discover-basic', 'session-replay'],
        testName: 'dark snapshot: features',
      },
    ]);
  });

  it('only generates feature metadata for non-empty feature sets', () => {
    expect(getSnapshotFeaturesTag([])).toBeUndefined();
    expect(getSnapshotFeaturesTag(['discover-basic', 'session-replay'])).toBe(
      'discover-basic,session-replay'
    );
  });
});
