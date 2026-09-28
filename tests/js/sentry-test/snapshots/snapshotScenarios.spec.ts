import {expandSnapshotScenarios} from './snapshotScenarios';

describe('expandSnapshotScenarios', () => {
  it('expands a logical snapshot into stable light and dark test names', () => {
    expect(expandSnapshotScenarios('default')).toEqual([
      {
        theme: 'light',
        container: '4xl',
        containerWidth: 960,
        testName: 'light snapshot: default',
      },
      {
        theme: 'dark',
        container: '4xl',
        containerWidth: 960,
        testName: 'dark snapshot: default',
      },
    ]);
  });

  it('keeps the viewport suffix stable across themes', () => {
    expect(expandSnapshotScenarios('default', ['4xl'], 'md')).toEqual([
      {
        theme: 'light',
        container: '4xl',
        containerWidth: 960,
        testName: 'light snapshot: default @md',
      },
      {
        theme: 'dark',
        container: '4xl',
        containerWidth: 960,
        testName: 'dark snapshot: default @md',
      },
    ]);
  });

  it('crosses declared containers with themes using stable token suffixes', () => {
    expect(expandSnapshotScenarios('responsive', ['xl', '7xl'])).toEqual([
      {
        theme: 'light',
        container: 'xl',
        containerWidth: 512,
        testName: 'light snapshot: responsive @xl',
      },
      {
        theme: 'light',
        container: '7xl',
        containerWidth: 1440,
        testName: 'light snapshot: responsive @7xl',
      },
      {
        theme: 'dark',
        container: 'xl',
        containerWidth: 512,
        testName: 'dark snapshot: responsive @xl',
      },
      {
        theme: 'dark',
        container: '7xl',
        containerWidth: 1440,
        testName: 'dark snapshot: responsive @7xl',
      },
    ]);
  });
});
