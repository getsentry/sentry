import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {getArtifactIcon} from 'sentry/components/events/autofix/v2/artifactCards';
import {t} from 'sentry/locale';
import type {Artifact} from 'sentry/views/seerExplorer/types';

interface ArtifactPreviewProps {
  artifacts: Record<string, Artifact>;
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
function getOneLineDescription(key: string, artifact: Artifact): string | null {
  const data = artifact.data;
  if (!data) {
    return null;
  }

  switch (key) {
    case 'root_cause':
      return getStringField(data, 'one_line_description');
    case 'solution':
      return getStringField(data, 'one_line_summary');
    case 'impact_assessment':
      return getStringField(data, 'one_line_description');
    case 'triage': {
      const suspectCommit = data.suspect_commit as {sha?: string} | null | undefined;
      if (suspectCommit?.sha) {
        return `Suspect: ${suspectCommit.sha.slice(0, 7)}`;
      }
      const suggestedAssignee = data.suggested_assignee as
        | {name?: string}
        | null
        | undefined;
      if (suggestedAssignee?.name) {
        return `Suggested: ${suggestedAssignee.name}`;
      }
      return null;
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
export function ExplorerArtifactPreviews({artifacts}: ArtifactPreviewProps) {
  const artifactKeys = ['root_cause', 'solution', 'impact_assessment', 'triage'];
  const displayedArtifacts = artifactKeys.filter(key => key in artifacts);

  if (displayedArtifacts.length === 0) {
    return null;
  }

  return (
    <Container paddingBottom="xs">
      <Flex direction="column" gap="md">
        {displayedArtifacts.map(key => {
          const artifact = artifacts[key];
          if (!artifact) {
            return null;
          }
          const title = ARTIFACT_TITLES[key] || key;
          const description = getOneLineDescription(key, artifact);

          return (
            <Container key={key} padding="md" radius="md" border="primary">
              <Flex direction="column" gap="md">
                <Flex align="center" gap="md">
                  {getArtifactIcon(
                    key as 'root_cause' | 'solution' | 'impact_assessment' | 'triage',
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
