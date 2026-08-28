import type {AutofixOverviewResponse, OverviewRun, RunStatus} from './types';
import {detectMilestoneAdvances, runsMissingStats} from './useAutofixOverview';

const emptyMilestones = {
  autofix_root_cause: [],
  autofix_solution: [],
  autofix_code_changes: [],
  has_pull_request: [],
  pull_requests_merged: [],
};

// The helpers only read seerRunId and status, so a minimal cast is sufficient.
const run = (seerRunId: string, status: RunStatus | null = null) =>
  ({seerRunId, status}) as OverviewRun;

function response(
  partial: Partial<AutofixOverviewResponse['runsByMilestone']>
): AutofixOverviewResponse {
  return {
    runsByMilestone: {...emptyMilestones, ...partial},
    truncatedMilestones: [],
  };
}

describe('detectMilestoneAdvances', () => {
  it('returns nothing when either poll is missing', () => {
    const data = response({autofix_root_cause: [run('r1')]});
    expect(detectMilestoneAdvances(undefined, data)).toEqual([]);
    expect(detectMilestoneAdvances(data, undefined)).toEqual([]);
  });

  it('reports a run that moved up to a later milestone', () => {
    const prev = response({autofix_root_cause: [run('r1')]});
    const next = response({autofix_code_changes: [run('r1')]});

    const advances = detectMilestoneAdvances(prev, next);

    expect(advances).toEqual([
      {
        run: expect.objectContaining({seerRunId: 'r1'}),
        fromMilestone: 'autofix_root_cause',
        toMilestone: 'autofix_code_changes',
      },
    ]);
  });

  it('ignores a status-only change within the same milestone', () => {
    const prev = response({autofix_root_cause: [run('r1', 'processing')]});
    const next = response({autofix_root_cause: [run('r1', 'completed')]});
    expect(detectMilestoneAdvances(prev, next)).toEqual([]);
  });

  it('ignores a run that is new this poll', () => {
    const prev = response({autofix_root_cause: [run('r1')]});
    const next = response({
      autofix_root_cause: [run('r1')],
      autofix_solution: [run('r2')],
    });
    expect(detectMilestoneAdvances(prev, next)).toEqual([]);
  });

  it('does not report a run that moved to an earlier milestone', () => {
    const prev = response({autofix_code_changes: [run('r1')]});
    const next = response({autofix_root_cause: [run('r1')]});
    expect(detectMilestoneAdvances(prev, next)).toEqual([]);
  });

  it('reports each advanced run when several move at once', () => {
    const prev = response({
      autofix_root_cause: [run('r1')],
      autofix_solution: [run('r2')],
    });
    const next = response({
      autofix_solution: [run('r1')],
      autofix_code_changes: [run('r2')],
    });

    const advanced = detectMilestoneAdvances(prev, next).map(a => a.run.seerRunId);

    expect(advanced).toEqual(expect.arrayContaining(['r1', 'r2']));
    expect(advanced).toHaveLength(2);
  });
});

describe('runsMissingStats', () => {
  it('returns nothing when the poll is missing', () => {
    expect(runsMissingStats(undefined, new Map())).toEqual([]);
  });

  it('returns nothing when every run already has stats', () => {
    const poll = response({
      autofix_root_cause: [run('r1')],
      autofix_solution: [run('r2')],
    });
    expect(
      runsMissingStats(
        poll,
        new Map([
          ['r1', {}],
          ['r2', {}],
        ])
      )
    ).toEqual([]);
  });

  it('returns run ids the stats response does not cover', () => {
    const poll = response({
      autofix_root_cause: [run('r1'), run('r2')],
      autofix_code_changes: [run('r3')],
    });
    expect(runsMissingStats(poll, new Map([['r1', {}]])).sort()).toEqual(['r2', 'r3']);
  });
});
