import {
  DiffFileType,
  DiffLineType,
  isFilePatch,
  isRootCauseArtifact,
  isSolutionArtifact,
  type FilePatch,
} from 'sentry/components/events/autofix/types';
import type {
  RootCauseArtifact,
  SolutionArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {Artifact} from 'sentry/views/seerExplorer/types';

function makeValidDiffLine(): FilePatch['hunks'][number]['lines'][number] {
  return {
    diff_line_no: 1,
    line_type: DiffLineType.ADDED,
    source_line_no: null,
    target_line_no: 1,
    value: '+console.log("hello")',
  };
}

function makeValidHunk(): FilePatch['hunks'][number] {
  return {
    lines: [makeValidDiffLine()],
    section_header: '@@ -1,3 +1,4 @@',
    source_length: 3,
    source_start: 1,
    target_length: 4,
    target_start: 1,
  };
}

function makeValidFilePatch(): FilePatch {
  return {
    added: 1,
    hunks: [makeValidHunk()],
    path: 'src/index.ts',
    removed: 0,
    source_file: 'a/src/index.ts',
    target_file: 'b/src/index.ts',
    type: DiffFileType.MODIFIED,
  };
}

function makeValidArtifact<T>(data: T): Artifact<T> {
  return {
    key: 'artifact-1',
    reason: 'Found a root cause',
    data,
  };
}

describe('isFilePatch', () => {
  it('returns true for a valid FilePatch', () => {
    expect(isFilePatch(makeValidFilePatch())).toBe(true);
  });

  it('returns false for null and non-objects', () => {
    expect(isFilePatch(null)).toBe(false);
    expect(isFilePatch(undefined)).toBe(false);
    expect(isFilePatch('string')).toBe(false);
    expect(isFilePatch(42)).toBe(false);
  });

  it('returns false for objects missing required fields', () => {
    const {added: _, ...noAdded} = makeValidFilePatch();
    expect(isFilePatch(noAdded)).toBe(false);

    expect(isFilePatch({...makeValidFilePatch(), path: 123})).toBe(false);
  });

  it('returns false when type is not a valid DiffFileType', () => {
    expect(isFilePatch({...makeValidFilePatch(), type: 'X'})).toBe(false);
  });

  it('returns false when hunks contain invalid entries', () => {
    expect(
      isFilePatch({
        ...makeValidFilePatch(),
        hunks: [{lines: [], source_start: 1}],
      })
    ).toBe(false);
  });

  it('returns false when nested lines contain invalid DiffLine entries', () => {
    const badHunk = {
      ...makeValidHunk(),
      lines: [{diff_line_no: 1, line_type: 'INVALID', source_line_no: null}],
    };
    expect(isFilePatch({...makeValidFilePatch(), hunks: [badHunk]})).toBe(false);
  });

  it('returns true when hunks is an empty array', () => {
    expect(isFilePatch({...makeValidFilePatch(), hunks: []})).toBe(true);
  });
});

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
