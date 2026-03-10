import {
  isRootCauseArtifact,
  isSolutionArtifact,
  type RootCauseArtifact,
  type SolutionArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {Artifact} from 'sentry/views/seerExplorer/types';

function makeValidArtifact<T>(data: T): Artifact<T> {
  return {
    key: 'artifact-1',
    reason: 'Found a root cause',
    data,
  };
}

describe('isRootCauseArtifact', () => {
  function makeValidRootCauseData(): RootCauseArtifact {
    return {
      one_line_description: 'Null pointer in handler',
      five_whys: ['Why 1', 'Why 2'],
      reproduction_steps: ['Step 1', 'Step 2'],
    };
  }

  it('returns true for a valid RootCauseArtifact', () => {
    expect(isRootCauseArtifact(makeValidArtifact(makeValidRootCauseData()))).toBe(true);
  });

  it('returns false for non-artifact objects', () => {
    expect(isRootCauseArtifact(null)).toBe(false);
    expect(isRootCauseArtifact({data: makeValidRootCauseData()})).toBe(false);
    expect(isRootCauseArtifact({key: 'k', data: makeValidRootCauseData()})).toBe(false);
  });

  it('returns false when data is null', () => {
    expect(isRootCauseArtifact({key: 'k', reason: 'r', data: null})).toBe(false);
  });

  it('returns false when data has wrong types', () => {
    expect(
      isRootCauseArtifact(
        makeValidArtifact({
          one_line_description: 'ok',
          five_whys: [1, 2],
          reproduction_steps: ['Step 1'],
        })
      )
    ).toBe(false);

    expect(
      isRootCauseArtifact(
        makeValidArtifact({
          one_line_description: 123,
          five_whys: ['Why'],
          reproduction_steps: ['Step'],
        })
      )
    ).toBe(false);
  });
});

describe('isSolutionArtifact', () => {
  function makeValidSolutionData(): SolutionArtifact {
    return {
      one_line_summary: 'Fix the null check',
      steps: [{title: 'Step 1', description: 'Do the thing'}],
    };
  }

  it('returns true for a valid SolutionArtifact', () => {
    expect(isSolutionArtifact(makeValidArtifact(makeValidSolutionData()))).toBe(true);
  });

  it('returns false for non-artifact objects', () => {
    expect(isSolutionArtifact(null)).toBe(false);
    expect(isSolutionArtifact({data: makeValidSolutionData()})).toBe(false);
  });

  it('returns false when data is null', () => {
    expect(isSolutionArtifact({key: 'k', reason: 'r', data: null})).toBe(false);
  });

  it('returns false when steps contains invalid objects', () => {
    expect(
      isSolutionArtifact(
        makeValidArtifact({
          one_line_summary: 'Fix it',
          steps: [{title: 'Missing description'}],
        })
      )
    ).toBe(false);

    expect(
      isSolutionArtifact(
        makeValidArtifact({
          one_line_summary: 'Fix it',
          steps: [{description: 'Missing title'}],
        })
      )
    ).toBe(false);
  });

  it('returns true when steps is an empty array', () => {
    expect(
      isSolutionArtifact(
        makeValidArtifact({
          one_line_summary: 'Fix it',
          steps: [],
        })
      )
    ).toBe(true);
  });
});
