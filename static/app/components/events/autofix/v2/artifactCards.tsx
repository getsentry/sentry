import {Fragment} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {
  CodingAgentProvider,
  getResultButtonLabel,
} from 'sentry/components/events/autofix/types';
import type {SolutionArtifact} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  cardAnimationProps,
  StyledMarkedText,
} from 'sentry/components/events/autofix/v2/utils';
import {TimeSince} from 'sentry/components/timeSince';
import {IconCode, IconFix, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {FileDiffViewer} from 'sentry/views/seerExplorer/fileDiffViewer';
import type {
  ExplorerCodingAgentState,
  ExplorerFilePatch,
  RepoPRState,
} from 'sentry/views/seerExplorer/types';

export type ArtifactData = Record<string, unknown>;

/**
 * Get the colored icon for an artifact type.
 * Shared utility for consistent icon styling across artifact displays.
 */
function getArtifactIcon(
  artifactType: 'solution' | 'code_changes',
  size: 'xs' | 'sm' | 'md' | 'lg' = 'md'
): React.ReactNode {
  switch (artifactType) {
    case 'solution':
      return <IconFix size={size} variant="success" />;
    case 'code_changes':
      return <IconCode size={size} variant="accent" />;
    default:
      return null;
  }
}

interface CardProps {
  children: React.ReactNode;
  title: string;
  icon?: React.ReactNode;
}

function ArtifactCard({title, icon, children}: CardProps) {
  return (
    <AnimatedCard {...cardAnimationProps}>
      <Container border="primary" radius="md" background="primary" padding="md">
        <Flex align="center" justify="between" padding="md">
          <Flex align="center" gap="md">
            {icon}
            <Heading as="h3">{title}</Heading>
          </Flex>
        </Flex>
        <Container padding="lg">
          <Flex direction="column" gap="xl">
            {children}
          </Flex>
        </Container>
      </Container>
    </AnimatedCard>
  );
}

/**
 * Renders a tree row with title as key and description as value.
 */
function TreeRowWithDescription({
  description,
  title,
  icon,
  showIcon = false,
  spacerCount = 0,
}: {
  description: string;
  title: string;
  icon?: React.ReactNode;
  showIcon?: boolean;
  spacerCount?: number;
}) {
  return (
    <Fragment>
      {/* Title as key */}
      <TreeRow>
        <TreeKeyTrunk spacerCount={spacerCount}>
          {spacerCount > 0 && (
            <Fragment>
              <TreeSpacer spacerCount={spacerCount} hasStem={false} />
              <TreeBranchIcon />
            </Fragment>
          )}
          <Flex align="center" gap="xs">
            <ImpactTreeKey as="div">
              <StyledMarkedText text={title} inline as="span" />
            </ImpactTreeKey>
            {showIcon && icon}
          </Flex>
        </TreeKeyTrunk>
      </TreeRow>

      {/* Description as value */}
      <TreeRow>
        <TreeKeyTrunk spacerCount={spacerCount + 1}>
          <TreeSpacer spacerCount={spacerCount + 1} hasStem={false} />
          <TreeBranchIcon />
          <SolutionTreeValue as="div">
            <StyledMarkedText text={description} inline as="span" />
          </SolutionTreeValue>
        </TreeKeyTrunk>
      </TreeRow>
    </Fragment>
  );
}

/**
 * Renders solution steps as a tree structure.
 */
function SolutionTree({steps}: {steps: SolutionArtifact['steps']}) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <TreeContainer columnCount={0}>
      {steps.map((step, index) => (
        <TreeRowWithDescription
          key={index}
          title={step.title}
          description={step.description}
          spacerCount={0}
        />
      ))}
    </TreeContainer>
  );
}

/**
 * Solution artifact card.
 */
export function SolutionCard({data}: {data: ArtifactData}) {
  const typedData = data as unknown as SolutionArtifact;

  return (
    <ArtifactCard title={t('Solution')} icon={getArtifactIcon('solution')}>
      <Text size="lg" as="div">
        <StyledMarkedText text={typedData.one_line_summary} inline as="span" />
      </Text>

      {typedData.steps.length > 0 && <SolutionTree steps={typedData.steps} />}
    </ArtifactCard>
  );
}

interface CodeChangesCardProps {
  patches: ExplorerFilePatch[];
  onCreatePR?: (repoName?: string) => void;
  prStates?: Record<string, RepoPRState>;
}

/**
 * Code Changes card showing file diffs.
 */
export function CodeChangesCard({patches, prStates, onCreatePR}: CodeChangesCardProps) {
  // Group by repo
  const patchesByRepo = new Map<string, ExplorerFilePatch[]>();
  for (const patch of patches) {
    const existing = patchesByRepo.get(patch.repo_name) || [];
    existing.push(patch);
    patchesByRepo.set(patch.repo_name, existing);
  }

  return (
    <ArtifactCard title={t('Code Changes')} icon={getArtifactIcon('code_changes')}>
      {Array.from(patchesByRepo.entries()).map(([repoName, repoPatches]) => {
        const prState = prStates?.[repoName];
        const isCreatingPR = prState?.pr_creation_status === 'creating';

        return (
          <RepoSection key={repoName}>
            <Flex justify="between" align="center" marginBottom="xl">
              <RepoName>{repoName}</RepoName>
              {prState?.pr_url ? (
                <a href={prState.pr_url} target="_blank" rel="noopener noreferrer">
                  {t('View PR #%s', prState.pr_number)}
                </a>
              ) : onCreatePR ? (
                <Button
                  size="sm"
                  onClick={() => onCreatePR(repoName)}
                  disabled={isCreatingPR}
                >
                  {isCreatingPR ? t('Creating PR...') : t('Create PR')}
                </Button>
              ) : null}
            </Flex>

            <Flex direction="column" gap="sm">
              {repoPatches.map((patch, index) => (
                <FileDiffViewer
                  patch={patch.patch}
                  showBorder
                  collapsible
                  defaultExpanded={repoPatches.length > 1 ? false : true}
                  key={`${patch.patch.path}-${index}`}
                />
              ))}
            </Flex>
          </RepoSection>
        );
      })}
    </ArtifactCard>
  );
}

interface CodingAgentHandoffCardProps {
  codingAgents: Record<string, ExplorerCodingAgentState>;
}

/**
 * Card showing the status of coding agents launched from an Explorer run.
 */
export function CodingAgentHandoffCard({codingAgents}: CodingAgentHandoffCardProps) {
  const agents = Object.values(codingAgents);

  if (agents.length === 0) {
    return null;
  }

  const getStatusText = (status: ExplorerCodingAgentState['status']) => {
    switch (status) {
      case 'pending':
        return t('Pending...');
      case 'running':
        return t('Running...');
      case 'completed':
        return t('Completed');
      case 'failed':
        return t('Failed');
      default:
        return status;
    }
  };

  const getProviderDisplayName = (provider: string) => {
    switch (provider) {
      case CodingAgentProvider.CURSOR_BACKGROUND_AGENT:
        return t('Cursor Cloud Agent');
      case CodingAgentProvider.CLAUDE_CODE_AGENT:
        return t('Claude Agent');
      case CodingAgentProvider.GITHUB_COPILOT_AGENT:
        return t('GitHub Copilot');
      default:
        return t('Coding Agent');
    }
  };

  const getOpenButtonText = (provider: string) => {
    switch (provider) {
      case CodingAgentProvider.CURSOR_BACKGROUND_AGENT:
        return t('Open in Cursor');
      case CodingAgentProvider.CLAUDE_CODE_AGENT:
        return t('Open in Claude');
      default:
        return t('Open Session');
    }
  };

  return (
    <ArtifactCard
      title={getProviderDisplayName(agents[0]?.provider ?? 'Coding Agent')}
      icon={<IconCode size="md" variant="accent" />}
    >
      <Flex direction="column" gap="xl">
        {agents.map(agent => (
          <CodingAgentSection key={agent.id}>
            <Flex justify="between" align="center">
              <Flex direction="column" gap="xs">
                <Text size="lg">{agent.name}</Text>
                <Text variant="muted" size="sm">
                  <TimeSince date={agent.started_at} />
                </Text>
              </Flex>
              <CodingAgentStatusTag $status={agent.status}>
                {getStatusText(agent.status)}
              </CodingAgentStatusTag>
            </Flex>

            {agent.results && agent.results.length > 0 && (
              <Flex direction="column" gap="md">
                {agent.results.map((result, index) => (
                  <CodingAgentResultItem key={index}>
                    <Text size="sm" as="div">
                      <StyledMarkedText text={result.description} inline as="span" />
                    </Text>
                  </CodingAgentResultItem>
                ))}
              </Flex>
            )}

            <Flex gap="md" justify="end">
              {agent.agent_url && (
                <Button
                  size="sm"
                  icon={<IconOpen />}
                  onClick={() => {
                    window.open(agent.agent_url, '_blank', 'noopener,noreferrer');
                  }}
                >
                  {getOpenButtonText(agent.provider)}
                </Button>
              )}
              {agent.results
                ?.filter(result => result.pr_url)
                .map(result => (
                  <Button
                    key={result.pr_url}
                    size="sm"
                    icon={<IconOpen />}
                    onClick={() => {
                      window.open(result.pr_url, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    {getResultButtonLabel(result.pr_url)}
                  </Button>
                ))}
            </Flex>
          </CodingAgentSection>
        ))}
      </Flex>
    </ArtifactCard>
  );
}

const CodingAgentSection = styled('div')`
  &:not(:last-child) {
    margin-bottom: ${p => p.theme.space.xl};
    padding-bottom: ${p => p.theme.space.xl};
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

const CodingAgentStatusTag = styled('span')<{
  $status: ExplorerCodingAgentState['status'];
}>`
  display: inline-flex;
  align-items: center;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  border-radius: ${p => p.theme.radius.sm};
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  background-color: ${p => {
    switch (p.$status) {
      case 'completed':
        return p.theme.colors.green100;
      case 'failed':
        return p.theme.colors.red100;
      default:
        return p.theme.colors.blue100;
    }
  }};
  color: ${p => {
    switch (p.$status) {
      case 'completed':
        return p.theme.tokens.content.success;
      case 'failed':
        return p.theme.tokens.content.danger;
      default:
        return p.theme.tokens.content.accent;
    }
  }};
`;

const CodingAgentResultItem = styled('div')`
  padding: ${p => p.theme.space.md};
  border-radius: ${p => p.theme.radius.sm};
`;

const TreeContainer = styled('div')<{columnCount: number}>`
  display: grid;
  grid-template-columns: repeat(${p => p.columnCount}, 1fr);
  align-items: start;
  white-space: normal;
`;

const TreeRow = styled('div')`
  border-radius: ${p => p.theme.space.xs};
  padding-left: ${p => p.theme.space.md};
  position: relative;
  display: grid;
  align-items: center;
  grid-column: span 2;
  column-gap: ${p => p.theme.space.lg};
  grid-template-columns: subgrid;
  :nth-child(odd) {
    background-color: ${p => p.theme.tokens.background.secondary};
  }
  color: ${p => p.theme.tokens.content.secondary};
  background-color: ${p => p.theme.tokens.background.primary};
`;

const TreeSpacer = styled('div')<{hasStem: boolean; spacerCount: number}>`
  grid-column: span 1;
  /* Allows TreeBranchIcons to appear connected vertically */
  border-right: 1px solid
    ${p => (p.hasStem ? p.theme.tokens.border.primary : 'transparent')};
  margin-right: -1px;
  height: 100%;
  width: ${p => (p.spacerCount - 1) * 20 + 3}px;
`;

const TreeBranchIcon = styled('div')`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-width: 0 0 1px 1px;
  border-radius: 0 0 0 5px;
  grid-column: span 1;
  height: 12px;
  align-self: start;
  margin-right: ${p => p.theme.space.xs};
`;

const TreeKeyTrunk = styled('div')<{spacerCount: number}>`
  grid-column: 1 / 2;
  display: grid;
  height: 100%;
  align-items: center;
  grid-template-columns: ${p => (p.spacerCount > 0 ? `auto 1rem 1fr` : '1fr')};
`;

const TreeValue = styled('div')`
  padding: ${p => p.theme.space['2xs']} 0;
  align-self: start;
  font-size: ${p => p.theme.font.size.sm};
  word-break: break-word;
  grid-column: span 1;
  color: ${p => p.theme.tokens.content.primary};
`;

const TreeKey = styled(TreeValue)`
  color: ${p => p.theme.tokens.content.primary};
`;

const ImpactTreeKey = styled(TreeKey)`
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;

const SolutionTreeValue = styled(TreeValue)`
  color: ${p => p.theme.tokens.content.secondary};
`;

const RepoName = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
`;

const RepoSection = styled('div')`
  &:not(:last-child) {
    margin-bottom: ${p => p.theme.space['2xl']};
    padding-bottom: ${p => p.theme.space['2xl']};
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

const AnimatedCard = styled(motion.div)`
  transform-origin: top center;
`;
