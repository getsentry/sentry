import type {FilePatch} from 'sentry/components/events/autofix/types';
import {DiffFileType, DiffLineType} from 'sentry/components/events/autofix/types';
import type {
  RootCauseArtifact,
  SolutionArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {
  Artifact,
  ExplorerFilePatch,
  RepoPRState,
} from 'sentry/views/seerExplorer/types';

import {artifactToMarkdown} from './utils';

function makeFilePatch(overrides?: Partial<FilePatch>): FilePatch {
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
            value: '+console.log("hello")',
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
    ...overrides,
  };
}

function makeRootCauseArtifact(
  overrides?: Partial<Artifact<RootCauseArtifact>>
): Artifact<RootCauseArtifact> {
  return {
    key: 'root_cause',
    reason: 'Found the root cause',
    data: {
      one_line_description: 'Null pointer in handler',
      five_whys: ['Missing null check', 'No validation'],
      reproduction_steps: ['Send empty request', 'Observe crash'],
    },
    ...overrides,
  };
}

function makeSolutionArtifact(
  overrides?: Partial<Artifact<SolutionArtifact>>
): Artifact<SolutionArtifact> {
  return {
    key: 'solution',
    reason: 'Proposed a fix',
    data: {
      one_line_summary: 'Add null check before accessing property',
      steps: [
        {title: 'Add guard clause', description: 'Check for null before accessing .name'},
        {title: 'Add test', description: 'Cover the null input case'},
      ],
    },
    ...overrides,
  };
}

function makeExplorerFilePatch(
  overrides?: Partial<ExplorerFilePatch>
): ExplorerFilePatch {
  return {
    diff: '--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,3 +1,4 @@\n+console.log("hello")',
    patch: makeFilePatch(),
    repo_name: 'getsentry/sentry',
    ...overrides,
  };
}

function makeRepoPRState(overrides?: Partial<RepoPRState>): RepoPRState {
  return {
    branch_name: 'fix/null-check',
    commit_sha: 'abc123',
    pr_creation_error: null,
    pr_creation_status: 'completed',
    pr_id: 1,
    pr_number: 42,
    pr_url: 'https://github.com/getsentry/sentry/pull/42',
    repo_name: 'getsentry/sentry',
    title: 'Fix null pointer',
    ...overrides,
  };
}

describe('artifactToMarkdown', () => {
  describe('root cause artifact', () => {
    it('renders full root cause with five_whys and reproduction_steps', () => {
      expect(artifactToMarkdown(makeRootCauseArtifact())).toBe(
        [
          '# Root Cause',
          '',
          'Null pointer in handler',
          '',
          '## Why did this happen?',
          '',
          '- Missing null check',
          '- No validation',
          '',
          '## Reproduction Steps',
          '',
          '1. Send empty request',
          '2. Observe crash',
        ].join('\n')
      );
    });

    it('returns null when data is null', () => {
      expect(artifactToMarkdown(makeRootCauseArtifact({data: null}))).toBeNull();
    });

    it('renders minimal markdown with empty five_whys and no reproduction_steps', () => {
      const artifact = makeRootCauseArtifact({
        data: {
          one_line_description: 'Something broke',
          five_whys: [],
        },
      });
      expect(artifactToMarkdown(artifact)).toBe(
        ['# Root Cause', '', 'Something broke'].join('\n')
      );
    });
  });

  describe('solution artifact', () => {
    it('renders full solution with steps', () => {
      expect(artifactToMarkdown(makeSolutionArtifact())).toBe(
        [
          '# Implementation Plan',
          '',
          'Add null check before accessing property',
          '',
          '## Steps to Resolve',
          '',
          '### 1. Add guard clause',
          'Check for null before accessing .name',
          '### 2. Add test',
          'Cover the null input case',
        ].join('\n')
      );
    });

    it('returns null when data is null', () => {
      expect(artifactToMarkdown(makeSolutionArtifact({data: null}))).toBeNull();
    });

    it('renders minimal markdown with empty steps', () => {
      const artifact = makeSolutionArtifact({
        data: {
          one_line_summary: 'Quick fix',
          steps: [],
        },
      });
      expect(artifactToMarkdown(artifact)).toBe(
        ['# Implementation Plan', '', 'Quick fix'].join('\n')
      );
    });
  });

  describe('ExplorerFilePatch[]', () => {
    it('renders patches with diff code blocks', () => {
      const diff1 =
        '--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,3 +1,4 @@\n+console.log("hello")';
      const diff2 = '+ new line';
      const patches = [
        makeExplorerFilePatch({diff: diff1}),
        makeExplorerFilePatch({repo_name: 'getsentry/relay', diff: diff2}),
      ];
      expect(artifactToMarkdown(patches)).toBe(
        [
          '# Code Changes',
          '',
          '## Repository: getsentry/sentry',
          '',
          '```diff',
          diff1,
          '```',
          '',
          '## Repository: getsentry/relay',
          '',
          '```diff',
          diff2,
          '```',
        ].join('\n')
      );
    });

    it('returns null for empty array', () => {
      const patches: ExplorerFilePatch[] = [];
      expect(artifactToMarkdown(patches)).toBeNull();
    });
  });

  describe('RepoPRState[]', () => {
    it('renders PR links', () => {
      const prs = [makeRepoPRState()];
      expect(artifactToMarkdown(prs)).toBe(
        [
          '# Pull Requests',
          '',
          '[getsentry/sentry#42](https://github.com/getsentry/sentry/pull/42)',
        ].join('\n')
      );
    });

    it('filters out PRs missing url or number', () => {
      const prs = [
        makeRepoPRState({pr_url: null}),
        makeRepoPRState({pr_number: null}),
        makeRepoPRState(), // valid
      ];
      expect(artifactToMarkdown(prs)).toBe(
        [
          '# Pull Requests',
          '',
          '[getsentry/sentry#42](https://github.com/getsentry/sentry/pull/42)',
        ].join('\n')
      );
    });

    it('returns null for empty array', () => {
      const prs: RepoPRState[] = [];
      expect(artifactToMarkdown(prs)).toBeNull();
    });
  });

  describe('unknown artifact', () => {
    it('returns null for unrecognized values', () => {
      expect(artifactToMarkdown('something unknown' as any)).toBeNull();
    });
  });
});
