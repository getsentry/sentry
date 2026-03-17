import {
  isCodeChangesArtifact,
  isPullRequestsArtifact,
  isRootCauseArtifact,
  isSolutionArtifact,
  type AutofixArtifact,
  type RootCauseArtifact,
  type SolutionArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {defined} from 'sentry/utils';
import {
  type Artifact,
  type ExplorerFilePatch,
  type RepoPRState,
} from 'sentry/views/seerExplorer/types';

export function artifactToMarkdown(artifact: AutofixArtifact): string | null {
  if (isRootCauseArtifact(artifact)) {
    return rootCauseArtifactToMarkdown(artifact);
  }

  if (isSolutionArtifact(artifact)) {
    return solutionArtifactToMarkdown(artifact);
  }

  if (isCodeChangesArtifact(artifact)) {
    return filePatchesToMarkdown(artifact);
  }

  if (isPullRequestsArtifact(artifact)) {
    return repoPRStatesToMarkdown(artifact);
  }

  return null; // unknown artifact
}

function rootCauseArtifactToMarkdown(
  artifact: Artifact<RootCauseArtifact>
): string | null {
  const rootCause = artifact.data;
  if (!defined(rootCause)) {
    return null;
  }

  const parts: string[] = ['# Root Cause', '', rootCause.one_line_description];

  if (rootCause.five_whys.length) {
    parts.push('');
    parts.push('## Why did this happen?');
    parts.push('');
    parts.push(...rootCause.five_whys.map(why => `- ${why}`));
  }

  if (rootCause.reproduction_steps?.length) {
    parts.push('');
    parts.push('## Reproduction Steps');
    parts.push('');
    parts.push(
      ...rootCause.reproduction_steps.map((step, index) => `${index + 1}. ${step}`)
    );
  }

  return parts.join('\n');
}

function solutionArtifactToMarkdown(artifact: Artifact<SolutionArtifact>): string | null {
  const solution = artifact.data;
  if (!defined(solution)) {
    return null;
  }

  const parts: string[] = ['# Implementation Plan', '', solution.one_line_summary];

  if (solution.steps.length) {
    parts.push('');
    parts.push('## Steps to Resolve');
    parts.push('');
    parts.push(
      ...solution.steps.flatMap((step, index) => [
        `### ${index + 1}. ${step.title}`,
        step.description,
      ])
    );
  }

  return parts.join('\n');
}

function filePatchesToMarkdown(artifact: ExplorerFilePatch[]): string | null {
  if (!artifact.length) {
    return null;
  }

  const parts: string[] = ['# Code Changes'];

  parts.push(
    ...artifact.flatMap(filePatch => [
      '',
      `## Repository: ${filePatch.repo_name}`,
      '',
      '```diff',
      filePatch.diff,
      '```',
    ])
  );

  return parts.join('\n');
}

function repoPRStatesToMarkdown(artifact: RepoPRState[]): string | null {
  if (!artifact.length) {
    return null;
  }

  const parts: string[] = ['# Pull Requests', ''];

  parts.push(
    ...artifact
      .map(pullRequest => {
        if (!pullRequest.pr_url || !pullRequest.pr_number) {
          return null;
        }
        return `[${pullRequest.repo_name}#${pullRequest.pr_number}](${pullRequest.pr_url})`;
      })
      .filter(defined)
  );

  return parts.join('\n');
}
