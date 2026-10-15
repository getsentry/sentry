import {expandSnapshotScenarios} from './snapshotScenarios';

describe('expandSnapshotScenarios', () => {
  it('expands a logical snapshot into stable light and dark test names', () => {
    expect(expandSnapshotScenarios('default')).toEqual([
      {theme: 'light', testName: 'light snapshot: default'},
      {theme: 'dark', testName: 'dark snapshot: default'},
    ]);
  });

  it('keeps the viewport suffix stable across themes', () => {
    expect(expandSnapshotScenarios('default', 'md')).toEqual([
      {theme: 'light', testName: 'light snapshot: default @md'},
      {theme: 'dark', testName: 'dark snapshot: default @md'},
    ]);
  });
});
