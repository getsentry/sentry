import {expectWithinModuleBudget} from 'sentry-test/moduleBudget';

// A spec that imports nothing else, so it measures what the Jest setup files load.
describe('Jest setup files', () => {
  it('stay within the module budget', () => {
    expectWithinModuleBudget('An empty spec', 1190);
  });

  // The setup files' per-test hooks can load more, so check again once they've run.
  afterAll(() => {
    expectWithinModuleBudget('An empty spec (after the per-test setup hooks)', 1620);
  });
});
