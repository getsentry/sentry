import type {AutofixOverviewResponse, OverviewRun, RunStatus} from './types';
import {
  detectMilestoneAdvances,
  isSameScope,
  overlayStatus,
  sectionSignature,
  shouldRefetchEnriched,
} from './useAutofixOverview';

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

describe('sectionSignature', () => {
  it('returns null when there is no data', () => {
    expect(sectionSignature(undefined)).toBeNull();
  });

  it('changes when a run moves to a new section', () => {
    const before = sectionSignature(response({autofix_root_cause: [run('r1')]}));
    const after = sectionSignature(response({has_pull_request: [run('r1')]}));
    expect(after).not.toEqual(before);
  });

  it('is stable when only a run status changes', () => {
    const before = sectionSignature(response({autofix_root_cause: [run('r1', null)]}));
    const after = sectionSignature(
      response({autofix_root_cause: [run('r1', 'processing')]})
    );
    expect(after).toEqual(before);
  });
});

describe('overlayStatus', () => {
  it('applies the polled status onto the matching run', () => {
    const base = response({autofix_root_cause: [run('r1', null)]});
    const poll = response({autofix_root_cause: [run('r1', 'processing')]});
    const merged = overlayStatus(base, poll);
    expect(merged.runsByMilestone.autofix_root_cause[0]!.status).toBe('processing');
  });

  it('returns the base unchanged when the poll has no runs', () => {
    const base = response({autofix_root_cause: [run('r1', 'completed')]});
    expect(overlayStatus(base, undefined)).toBe(base);
  });

  it('keeps the existing status when the poll reports null', () => {
    const base = response({autofix_root_cause: [run('r1', 'processing')]});
    const poll = response({autofix_root_cause: [run('r1', null)]});
    const merged = overlayStatus(base, poll);
    expect(merged.runsByMilestone.autofix_root_cause[0]!.status).toBe('processing');
  });

  it('returns the base reference when no status changed', () => {
    const base = response({autofix_root_cause: [run('r1', 'processing')]});
    const poll = response({autofix_root_cause: [run('r1', 'processing')]});
    expect(overlayStatus(base, poll)).toBe(base);
  });
});

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

describe('shouldRefetchEnriched', () => {
  it('is false when either side has no data', () => {
    const data = response({autofix_root_cause: [run('r1')]});
    expect(shouldRefetchEnriched(undefined, data)).toBe(false);
    expect(shouldRefetchEnriched(data, undefined)).toBe(false);
  });

  it('is false when the sections match', () => {
    const sections = {autofix_root_cause: [run('r1')]};
    expect(shouldRefetchEnriched(response(sections), response(sections))).toBe(false);
  });

  it('is false when only a run status differs', () => {
    expect(
      shouldRefetchEnriched(
        response({autofix_root_cause: [run('r1', 'processing')]}),
        response({autofix_root_cause: [run('r1', 'completed')]})
      )
    ).toBe(false);
  });

  it('is true when the poll and enriched sections diverge', () => {
    const poll = response({has_pull_request: [run('r1')]});
    const enriched = response({autofix_root_cause: [run('r1')]});
    expect(shouldRefetchEnriched(poll, enriched)).toBe(true);
  });
});

describe('isSameScope', () => {
  const scope = {project: [2], statsPeriod: '14d'};

  it('is true across a sort or expand change', () => {
    expect(
      isSameScope(
        {...scope, expand: ['status']},
        {...scope, sort: 'events', expand: ['scmInfo', 'issueStats', 'status']}
      )
    ).toBe(true);
  });

  it('is false when the projects change', () => {
    expect(isSameScope(scope, {...scope, project: [2, 3]})).toBe(false);
  });

  it('is false when the time window changes', () => {
    expect(isSameScope(scope, {...scope, statsPeriod: '24h'})).toBe(false);
    expect(
      isSameScope(scope, {
        project: [2],
        start: '2026-07-01T00:00:00',
        end: '2026-07-02T00:00:00',
      })
    ).toBe(false);
  });

  it('is false with no previous query', () => {
    expect(isSameScope(undefined, scope)).toBe(false);
  });
});
