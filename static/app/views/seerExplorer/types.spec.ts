import {
  DiffFileType,
  DiffLineType,
  type FilePatch,
} from 'sentry/components/events/autofix/types';

import {isArtifact, isExplorerFilePatch, isRepoPRState, type RepoPRState} from './types';

function makeValidFilePatch(): FilePatch {
  return {
    added: 1,
    hunks: [
      {
        lines: [
          {
            diff_line_no: 1,
            line_type: DiffLineType.ADDED,
            source_line_no: null,
            target_line_no: 1,
            value: '+hello',
          },
        ],
        section_header: '@@ -1,3 +1,4 @@',
        source_length: 3,
        source_start: 1,
        target_length: 4,
        target_start: 1,
      },
    ],
    path: 'src/index.ts',
    removed: 0,
    source_file: 'a/src/index.ts',
    target_file: 'b/src/index.ts',
    type: DiffFileType.MODIFIED,
  };
}

describe('isExplorerFilePatch', () => {
  it('returns true for a valid ExplorerFilePatch', () => {
    expect(
      isExplorerFilePatch({patch: makeValidFilePatch(), repo_name: 'getsentry/sentry'})
    ).toBe(true);
  });

  it('returns false for null and non-objects', () => {
    expect(isExplorerFilePatch(null)).toBe(false);
    expect(isExplorerFilePatch(undefined)).toBe(false);
    expect(isExplorerFilePatch('string')).toBe(false);
  });

  it('returns false when patch is invalid', () => {
    expect(isExplorerFilePatch({patch: {}, repo_name: 'repo'})).toBe(false);
  });

  it('returns false when repo_name is missing or wrong type', () => {
    expect(isExplorerFilePatch({patch: makeValidFilePatch()})).toBe(false);
    expect(isExplorerFilePatch({patch: makeValidFilePatch(), repo_name: 123})).toBe(
      false
    );
  });
});

describe('isRepoPRState', () => {
  function makeValidRepoPRState(): RepoPRState {
    return {
      branch_name: 'fix/bug',
      commit_sha: 'abc123',
      pr_creation_error: null,
      pr_creation_status: 'completed' as const,
      pr_id: 42,
      pr_number: 100,
      pr_url: 'https://github.com/org/repo/pull/100',
      repo_name: 'org/repo',
      title: 'Fix the bug',
    };
  }

  it('returns true for a valid RepoPRState with all fields populated', () => {
    expect(isRepoPRState(makeValidRepoPRState())).toBe(true);
  });

  it('returns true when nullable fields are null', () => {
    expect(
      isRepoPRState({
        branch_name: null,
        commit_sha: null,
        pr_creation_error: null,
        pr_creation_status: null,
        pr_id: null,
        pr_number: null,
        pr_url: null,
        repo_name: 'org/repo',
        title: null,
      })
    ).toBe(true);
  });

  it('returns false for null and non-objects', () => {
    expect(isRepoPRState(null)).toBe(false);
    expect(isRepoPRState(undefined)).toBe(false);
    expect(isRepoPRState(42)).toBe(false);
  });

  it('returns false when repo_name is missing', () => {
    const {repo_name: _, ...noRepoName} = makeValidRepoPRState();
    expect(isRepoPRState(noRepoName)).toBe(false);
  });

  it('returns false when a nullable string field has wrong type', () => {
    expect(isRepoPRState({...makeValidRepoPRState(), branch_name: 123})).toBe(false);
    expect(isRepoPRState({...makeValidRepoPRState(), pr_url: true})).toBe(false);
  });

  it('returns false when a nullable number field has wrong type', () => {
    expect(isRepoPRState({...makeValidRepoPRState(), pr_id: 'not-a-number'})).toBe(false);
    expect(isRepoPRState({...makeValidRepoPRState(), pr_number: true})).toBe(false);
  });
});

describe('isArtifact', () => {
  it('returns true for a valid Artifact with data', () => {
    expect(isArtifact({key: 'k', reason: 'r', data: {foo: 'bar'}})).toBe(true);
  });

  it('returns true for a valid Artifact with null data', () => {
    expect(isArtifact({key: 'k', reason: 'r', data: null})).toBe(true);
  });

  it('returns false for null and non-objects', () => {
    expect(isArtifact(null)).toBe(false);
    expect(isArtifact(undefined)).toBe(false);
    expect(isArtifact('string')).toBe(false);
  });

  it('returns false when key is missing or not a string', () => {
    expect(isArtifact({reason: 'r', data: null})).toBe(false);
    expect(isArtifact({key: 123, reason: 'r', data: null})).toBe(false);
  });

  it('returns false when reason is missing or not a string', () => {
    expect(isArtifact({key: 'k', data: null})).toBe(false);
    expect(isArtifact({key: 'k', reason: 42, data: null})).toBe(false);
  });

  it('returns false when data property is missing entirely', () => {
    expect(isArtifact({key: 'k', reason: 'r'})).toBe(false);
  });
});
