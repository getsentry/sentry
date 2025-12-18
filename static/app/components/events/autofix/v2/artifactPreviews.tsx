import {useMemo} from 'react';

import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  getMergedFilePatchesFromBlocks,
  getOrderedArtifactKeys,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {getArtifactIcon} from 'sentry/components/events/autofix/v2/artifactCards';
import {t} from 'sentry/locale';
import type {Artifact, Block, RepoPRState} from 'sentry/views/seerExplorer/types';

interface ArtifactPreviewProps {
  artifacts: Record<string, Artifact>;
  blocks?: Block[];
  prStates?: Record<string, RepoPRState>;
}

const ARTIFACT_TITLES: Record<string, string> = {
  root_cause: t('Root Cause'),
  solution: t('Solution'),
  code_changes: t('Code Changes'),
  impact_assessment: t('Impact'),
  triage: t('Triage'),
};

/**
 * Get a string value from artifact data safely.
 */
function getStringField(data: Record<string, unknown>, field: string): string | null {
  const value = data[field];
  return typeof value === 'string' ? value : null;
}

/**
 * Get the one-line description from an artifact.
 */
function getOneLineDescription(
  key: string,
  artifact: Artifact | null,
  blocks: Block[] = [],
  prStates?: Record<string, RepoPRState>
): string | null {
  // Handle code_changes separately since it doesn't come from artifacts
  if (key === 'code_changes') {
    const filePatches = getMergedFilePatchesFromBlocks(blocks);
    if (filePatches.length === 0) {
      return null;
    }

    // Count PRs if prStates is provided
    if (prStates) {
      const prCount = Object.values(prStates).filter(state => state.pr_url).length;
      if (prCount > 0) {
        if (prCount === 1) {
          return t('1 pull request');
        }
        return t('%s pull requests', prCount);
      }
    }

    const uniqueFiles = new Set<string>();
    const uniqueRepos = new Set<string>();

    for (const patch of filePatches) {
      uniqueFiles.add(patch.patch.path);
      uniqueRepos.add(patch.repo_name);
    }

    const fileCount = uniqueFiles.size;
    const repoCount = uniqueRepos.size;

    if (fileCount === 1 && repoCount === 1) {
      return t('1 file modified in 1 repo');
    }
    if (repoCount === 1) {
      return t('%s files modified in 1 repo', fileCount);
    }
    return t('%s files modified in %s repos', fileCount, repoCount);
  }

  // For other artifacts, require artifact data
  if (!artifact?.data) {
    return null;
  }

  const data = artifact.data;

  switch (key) {
    case 'root_cause':
      return getStringField(data, 'one_line_description');
    case 'solution':
      return getStringField(data, 'one_line_summary');
    case 'impact_assessment':
      return getStringField(data, 'one_line_description');
    case 'triage': {
      const suspectCommit = data.suspect_commit as
        | {message?: string; sha?: string}
        | null
        | undefined;
      const suggestedAssignee = data.suggested_assignee as
        | {name?: string}
        | null
        | undefined;

      const parts: string[] = [];

      if (suspectCommit?.message) {
        const commitMessage = suspectCommit.message.split('\n')[0]?.trim();
        if (commitMessage) {
          parts.push(`Suspect commit: '${commitMessage}'`);
        }
      } else if (suspectCommit?.sha) {
        parts.push(`Suspect: ${suspectCommit.sha.slice(0, 7)}`);
      }

      if (suggestedAssignee?.name) {
        parts.push(`Suggested assignee: ${suggestedAssignee.name}`);
      }

      return parts.length > 0 ? parts.join(' • ') : null;
    }
    default:
      return null;
  }
}

/**
 * Preview cards for Explorer artifacts shown in the sidebar.
 *
 * Displays a compact view of each generated artifact with its title
 * and one-line description.
 */
export function ExplorerArtifactPreviews({
  artifacts,
  blocks = [],
  prStates,
}: ArtifactPreviewProps) {
  const orderedKeys = useMemo(
    () => getOrderedArtifactKeys(blocks, artifacts),
    [blocks, artifacts]
  );

  const hasCodeChanges = useMemo(() => {
    const filePatches = getMergedFilePatchesFromBlocks(blocks);
    return filePatches.length > 0;
  }, [blocks]);

  const displayedArtifacts = useMemo(() => {
    const artifactKeys = orderedKeys.filter(key => key in artifacts);
    if (hasCodeChanges && !artifactKeys.includes('code_changes')) {
      return [...artifactKeys, 'code_changes'];
    }
    return artifactKeys;
  }, [orderedKeys, artifacts, hasCodeChanges]);

  if (displayedArtifacts.length === 0) {
    return null;
  }

  return (
    <Container paddingBottom="xs">
      <Flex direction="column" gap="md">
        {displayedArtifacts.map(key => {
          const artifact = artifacts[key] || null;
          const title = ARTIFACT_TITLES[key] || key;
          const description = getOneLineDescription(key, artifact, blocks, prStates);

          if (!description) {
            return null;
          }

          return (
            <Container key={key} padding="md" radius="md" border="primary">
              <Flex direction="column" gap="md">
                <Flex align="center" gap="md">
                  {getArtifactIcon(
                    key as
                      | 'root_cause'
                      | 'solution'
                      | 'impact_assessment'
                      | 'triage'
                      | 'code_changes',
                    'sm'
                  )}
                  <Text bold ellipsis>
                    {title}
                  </Text>
                </Flex>
                {description && (
                  <Text size="md" wordBreak="break-word">
                    {description}
                  </Text>
                )}
              </Flex>
            </Container>
          );
        })}
      </Flex>
    </Container>
  );
}
