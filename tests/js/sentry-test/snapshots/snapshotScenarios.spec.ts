import {expandSnapshotScenarios} from './snapshotScenarios';

describe('expandSnapshotScenarios', () => {
  it('expands a logical snapshot into stable light and dark test names', () => {
    expect(expandSnapshotScenarios('default')).toEqual([
      {
        theme: 'light',
        container: '3xl',
        containerWidth: 1024,
        testName: 'light snapshot: default',
      },
      {
        theme: 'dark',
        container: '3xl',
        containerWidth: 1024,
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
        testName: 'light snapshot: default @md',
      },
      {
        theme: 'dark',
        container: '3xl',
        containerWidth: 1024,
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
        testName: 'light snapshot: responsive @container-xs',
      },
      {
        theme: 'light',
        container: '2xl',
        containerWidth: 896,
        testName: 'light snapshot: responsive @container-2xl',
      },
      {
        theme: 'dark',
        container: 'xs',
        containerWidth: 448,
        testName: 'dark snapshot: responsive @container-xs',
      },
      {
        theme: 'dark',
        container: '2xl',
        containerWidth: 896,
        testName: 'dark snapshot: responsive @container-2xl',
      },
    ]);
  });
});
