import {getCodingAgentName} from 'sentry/components/events/autofix/types';
import {
  isCodeChangesArtifact,
  isCodingAgentsArtifact,
  isPullRequestsArtifact,
  isRootCauseArtifact,
  isSolutionArtifact,
  type AutofixArtifact,
  type RootCauseArtifact,
  type SolutionArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {defined} from 'sentry/utils/defined';
import {
  type Artifact,
  type ExplorerCodingAgentState,
  type ExplorerFilePatch,
  type RepoPRState,
} from 'sentry/views/seerExplorer/types';

export function artifactToMarkdown(
  artifact: AutofixArtifact,
  headingLevel: 1 | 2 | 3 = 1
): string | null {
  if (isRootCauseArtifact(artifact)) {
    return rootCauseArtifactToMarkdown(artifact, headingLevel);
  }

  if (isSolutionArtifact(artifact)) {
    return solutionArtifactToMarkdown(artifact, headingLevel);
  }

  if (isCodeChangesArtifact(artifact)) {
    return filePatchesToMarkdown(artifact, headingLevel);
  }

  if (isPullRequestsArtifact(artifact)) {
    return repoPRStatesToMarkdown(artifact, headingLevel);
  }

  if (isCodingAgentsArtifact(artifact)) {
    return codingAgentsToMarkdown(artifact, headingLevel);
  }

  return null; // unknown artifact
}

function rootCauseArtifactToMarkdown(
  artifact: Artifact<RootCauseArtifact>,
  headingLevel: number
): string | null {
  const rootCause = artifact.data;
  if (!defined(rootCause)) {
    return null;
  }

  const h1 = '#'.repeat(headingLevel);
  const h2 = '#'.repeat(headingLevel + 1);

  const parts: string[] = [`${h1} Root Cause`, '', rootCause.one_line_description];

  if (rootCause.five_whys.length) {
    parts.push(
      '',
      `${h2} Why did this happen?`,
      '',
      ...rootCause.five_whys.map(why => `- ${why}`)
    );
  }

  if (rootCause.reproduction_steps?.length) {
    parts.push(
      '',
      `${h2} Reproduction Steps`,
      '',
      ...rootCause.reproduction_steps.map((step, index) => `${index + 1}. ${step}`)
    );
  }

  return parts.join('\n');
}

function solutionArtifactToMarkdown(
  artifact: Artifact<SolutionArtifact>,
  headingLevel: number
): string | null {
  const solution = artifact.data;
  if (!defined(solution)) {
    return null;
  }

  const h1 = '#'.repeat(headingLevel);
  const h2 = '#'.repeat(headingLevel + 1);
  const h3 = '#'.repeat(headingLevel + 2);

  const parts: string[] = [`${h1} Plan`, '', solution.one_line_summary];

  if (solution.steps.length) {
    parts.push(
      '',
      `${h2} Steps to Resolve`,
      '',
      ...solution.steps.flatMap((step, index) => [
        `${h3} ${index + 1}. ${step.title}`,
        step.description,
      ])
    );
  }

  return parts.join('\n');
}

function filePatchesToMarkdown(
  artifact: ExplorerFilePatch[],
  headingLevel: number
): string | null {
  if (!artifact.length) {
    return null;
  }

  const h1 = '#'.repeat(headingLevel);
  const h2 = '#'.repeat(headingLevel + 1);

  const parts: string[] = [`${h1} Code Changes`];

  parts.push(
    ...artifact.flatMap(filePatch => [
      '',
      `${h2} Repository: ${filePatch.repo_name}`,
      '',
      '```diff',
      filePatch.diff,
      '```',
    ])
  );

  return parts.join('\n');
}

function repoPRStatesToMarkdown(
  artifact: RepoPRState[],
  headingLevel: number
): string | null {
  if (!artifact.length) {
    return null;
  }

  const h1 = '#'.repeat(headingLevel);

  const parts: string[] = [`${h1} Pull Requests`, ''];

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

function codingAgentsToMarkdown(
  artifact: ExplorerCodingAgentState[],
  headingLevel: number
): string | null {
  if (!artifact.length) {
    return null;
  }

  const h1 = '#'.repeat(headingLevel);
  const h2 = '#'.repeat(headingLevel + 1);

  const parts: string[] = [`${h1} Coding Agents`, ''];

  parts.push(
    ...artifact
      .map(codingAgent => {
        if (!codingAgent.agent_url) {
          return null;
        }

        return [
          `${h2} ${getCodingAgentName(codingAgent.provider)}`,
          '',
          `[${codingAgent.name}](${codingAgent.agent_url})`,
        ];
      })
      .filter(defined)
      .flatMap(lines => lines)
  );

  return parts.join('\n');
}
