import {getProcessingLabel} from './overviewActions';
import type {OverviewRun} from './types';

const run = (overrides: Partial<OverviewRun> = {}): OverviewRun =>
  ({groupId: '2', shortId: 'SEER-1', seerRunId: 'run-1', ...overrides}) as OverviewRun;

describe('getProcessingLabel', () => {
  it('does not label a busy single run as creating a plan', () => {
    expect(getProcessingLabel('needs_investigation', run({isSingleRun: true}))).toBe(
      'Working…'
    );
    expect(getProcessingLabel('needs_investigation', run())).toBe('Creating Plan…');
  });
});
