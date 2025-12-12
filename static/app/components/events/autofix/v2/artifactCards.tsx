import {Fragment} from 'react';
import styled from '@emotion/styled';
import {motion, type MotionNodeAnimationOptions} from 'framer-motion';

import {Container, Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {Button} from 'sentry/components/core/button';
import {Text} from 'sentry/components/core/text';
import type {
  ImpactAssessmentArtifact,
  ImpactItem,
  RootCauseArtifact,
  SolutionArtifact,
  TriageArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  IconCode,
  IconFatal,
  IconFire,
  IconFix,
  IconFocus,
  IconUser,
  IconWarning,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import testableTransition from 'sentry/utils/testableTransition';
import {FileDiffViewer} from 'sentry/views/seerExplorer/fileDiffViewer';
import type {ExplorerFilePatch, RepoPRState} from 'sentry/views/seerExplorer/types';

type ArtifactData = Record<string, unknown>;

interface CardProps {
  children: React.ReactNode;
  title: string;
  icon?: React.ReactNode;
}

const cardAnimationProps: MotionNodeAnimationOptions = {
  exit: {opacity: 0, height: 0, scale: 0.8, y: -20},
  initial: {opacity: 0, height: 0, scale: 0.8},
  animate: {opacity: 1, height: 'auto', scale: 1},
  transition: testableTransition({
    duration: 0.1,
    height: {
      type: 'spring',
      bounce: 0.2,
    },
    scale: {
      type: 'spring',
      bounce: 0.2,
    },
    y: {
      type: 'tween',
      ease: 'easeOut',
    },
  }),
};

function ArtifactCard({title, icon, children}: CardProps) {
  return (
    <AnimatedCard {...cardAnimationProps} initial={false}>
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
 * Recursively renders a "why" item and its children in a tree structure.
 */
function WhyTreeRow({
  index,
  why,
  whys,
  spacerCount = 0,
}: {
  index: number;
  why: string;
  whys: string[];
  spacerCount?: number;
}) {
  const hasChild = index < whys.length - 1;
  const nextWhy = whys[index + 1];

  return (
    <Fragment>
      <TreeRow>
        <TreeKeyTrunk spacerCount={spacerCount}>
          {spacerCount > 0 && (
            <Fragment>
              <TreeSpacer spacerCount={spacerCount} hasStem={false} />
              <TreeBranchIcon />
            </Fragment>
          )}
          <TreeKey>{why}</TreeKey>
        </TreeKeyTrunk>
      </TreeRow>
      {hasChild && nextWhy !== undefined && (
        <WhyTreeRow
          index={index + 1}
          why={nextWhy}
          whys={whys}
          spacerCount={spacerCount + 1}
        />
      )}
    </Fragment>
  );
}

/**
 * Renders the 5 whys as a nested tree structure.
 */
function FiveWhysTree({whys}: {whys: string[]}) {
  if (whys.length === 0) {
    return null;
  }

  const firstWhy = whys[0];
  if (!firstWhy) {
    return null;
  }

  return (
    <TreeContainer columnCount={0}>
      <WhyTreeRow index={0} why={firstWhy} whys={whys} spacerCount={0} />
    </TreeContainer>
  );
}

/**
 * Renders a tree row with title as key and description as value.
 * Shared component for both impact items and solution steps.
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
          <ImpactTreeKeyContainer>
            <ImpactTreeKey>{title}</ImpactTreeKey>
            {showIcon && icon}
          </ImpactTreeKeyContainer>
        </TreeKeyTrunk>
      </TreeRow>

      {/* Description as value */}
      <TreeRow>
        <TreeKeyTrunk spacerCount={spacerCount + 1}>
          <TreeSpacer spacerCount={spacerCount + 1} hasStem={false} />
          <TreeBranchIcon />
          <TreeValue>{description}</TreeValue>
        </TreeKeyTrunk>
      </TreeRow>
    </Fragment>
  );
}

/**
 * Renders an impact item in a tree structure with label as key, description as value, and evidence as sub-value.
 */
function ImpactTreeRow({
  impact,
  spacerCount = 0,
}: {
  impact: ImpactItem;
  spacerCount?: number;
}) {
  const getSeverityIcon = () => {
    if (impact.rating === 'high') {
      return <IconFatal size="xs" color="error" />;
    }
    if (impact.rating === 'medium') {
      return <IconWarning size="xs" color="warning" />;
    }
    return null;
  };

  return (
    <Fragment>
      {/* Label as key */}
      <TreeRow>
        <TreeKeyTrunk spacerCount={spacerCount}>
          {spacerCount > 0 && (
            <Fragment>
              <TreeSpacer spacerCount={spacerCount} hasStem={false} />
              <TreeBranchIcon />
            </Fragment>
          )}
          <ImpactTreeKeyContainer>
            <ImpactTreeKey>{impact.label}</ImpactTreeKey>
            {getSeverityIcon()}
          </ImpactTreeKeyContainer>
        </TreeKeyTrunk>
      </TreeRow>

      {/* Description as value */}
      <TreeRow>
        <TreeKeyTrunk spacerCount={spacerCount + 1}>
          <TreeSpacer spacerCount={spacerCount + 1} hasStem={false} />
          <TreeBranchIcon />
          <TreeValue>{impact.impact_description}</TreeValue>
        </TreeKeyTrunk>
      </TreeRow>

      {/* Evidence as sub-value */}
      {impact.evidence && (
        <TreeRow>
          <TreeKeyTrunk spacerCount={spacerCount + 2}>
            <TreeSpacer spacerCount={spacerCount + 2} hasStem={false} />
            <TreeBranchIcon />
            <TreeSubValue>{impact.evidence}</TreeSubValue>
          </TreeKeyTrunk>
        </TreeRow>
      )}
    </Fragment>
  );
}

/**
 * Renders impacts as a tree structure.
 */
function ImpactTree({impacts}: {impacts: ImpactItem[]}) {
  if (impacts.length === 0) {
    return null;
  }

  return (
    <TreeContainer columnCount={0}>
      {impacts.map((impact, index) => (
        <ImpactTreeRow key={index} impact={impact} spacerCount={0} />
      ))}
    </TreeContainer>
  );
}

/**
 * Root Cause artifact card.
 */
export function RootCauseCard({data}: {data: ArtifactData}) {
  const typedData = data as unknown as RootCauseArtifact;

  return (
    <ArtifactCard title={t('Root Cause')} icon={<IconFocus size="md" color="pink400" />}>
      <Text>{typedData.one_line_description}</Text>

      {typedData.five_whys.length > 0 && <FiveWhysTree whys={typedData.five_whys} />}

      {typedData.reproduction_steps && typedData.reproduction_steps.length > 0 && (
        <Flex direction="column" gap="sm">
          <Text size="md" variant="muted">
            {t('Reproduction Steps')}
          </Text>
          <Flex direction="column" gap="sm">
            {typedData.reproduction_steps.map((step, index) => (
              <Container key={index}>
                <Text>{`${index + 1}. ${step}`}</Text>
              </Container>
            ))}
          </Flex>
        </Flex>
      )}
    </ArtifactCard>
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
    <ArtifactCard title={t('Solution')} icon={<IconFix size="md" color="success" />}>
      <Text>{typedData.one_line_summary}</Text>

      {typedData.steps.length > 0 && <SolutionTree steps={typedData.steps} />}
    </ArtifactCard>
  );
}

/**
 * Impact Assessment artifact card.
 */
export function ImpactCard({data}: {data: ArtifactData}) {
  const typedData = data as unknown as ImpactAssessmentArtifact;

  return (
    <ArtifactCard title={t('Impact')} icon={<IconFire size="md" color="error" />}>
      <Text>{typedData.one_line_description}</Text>

      {typedData.impacts.length > 0 && <ImpactTree impacts={typedData.impacts} />}
    </ArtifactCard>
  );
}

/**
 * Triage artifact card.
 * TODO: show actual suspect commit card and user avatar
 */
export function TriageCard({data}: {data: ArtifactData}) {
  const typedData = data as unknown as TriageArtifact;
  const hasSuspect = typedData.suspect_commit;
  const hasAssignee = typedData.suggested_assignee;

  if (!hasSuspect && !hasAssignee) {
    return (
      <ArtifactCard title={t('Triage')} icon={<IconUser size="md" color="blue400" />}>
        <Text variant="muted">{t('No triage information available.')}</Text>
      </ArtifactCard>
    );
  }

  return (
    <ArtifactCard title={t('Triage')} icon={<IconUser size="md" color="blue400" />}>
      {hasSuspect && (
        <Flex direction="column" gap="sm">
          <Text size="md" bold variant="muted">
            {t('Suspect Commit')}
          </Text>
          <Container padding="md" background="secondary" radius="md">
            <Flex direction="column" gap="sm">
              <code>{typedData.suspect_commit?.sha}</code>
              {typedData.suspect_commit?.description && (
                <Text variant="muted">{typedData.suspect_commit.description}</Text>
              )}
            </Flex>
          </Container>
        </Flex>
      )}

      {hasAssignee && (
        <Flex direction="column" gap="sm">
          <Text size="md" bold variant="muted">
            {t('Suggested Assignee')}
          </Text>
          <Container padding="md" background="secondary" radius="md">
            <Flex direction="column" gap="sm">
              <Text bold>{typedData.suggested_assignee?.name}</Text>
              <Text variant="muted" size="sm">
                {typedData.suggested_assignee?.email}
              </Text>
              {typedData.suggested_assignee?.why && (
                <Text variant="muted" size="sm" italic>
                  {typedData.suggested_assignee.why}
                </Text>
              )}
            </Flex>
          </Container>
        </Flex>
      )}
    </ArtifactCard>
  );
}

interface CodeChangesCardProps {
  patches: ExplorerFilePatch[];
  onCreatePR?: (repoName?: string) => void;
  prStates?: Record<string, RepoPRState>;
}

/**
 * Merge consecutive patches to the same file into a single unified diff.
 * This is needed because the Explorer may create multiple patches for the same file.
 */
function mergeFilePatches(patches: ExplorerFilePatch[]): ExplorerFilePatch[] {
  const patchesByFile = new Map<string, ExplorerFilePatch[]>();

  // Group patches by repo + file path
  for (const patch of patches) {
    const key = `${patch.repo_name}:${patch.patch.path}`;
    const existing = patchesByFile.get(key) || [];
    existing.push(patch);
    patchesByFile.set(key, existing);
  }

  // Merge patches for each file
  const merged: ExplorerFilePatch[] = [];
  for (const [, filePatches] of patchesByFile) {
    const firstPatch = filePatches[0];
    if (!firstPatch) {
      continue;
    }

    if (filePatches.length === 1) {
      merged.push(firstPatch);
    } else {
      // Merge hunks from multiple patches
      const mergedHunks = filePatches.flatMap(p => p.patch.hunks);

      merged.push({
        repo_name: firstPatch.repo_name,
        patch: {
          ...firstPatch.patch,
          hunks: mergedHunks,
          added: filePatches.reduce((sum, p) => sum + p.patch.added, 0),
          removed: filePatches.reduce((sum, p) => sum + p.patch.removed, 0),
        },
      });
    }
  }

  return merged;
}

/**
 * Code Changes card showing file diffs.
 */
export function CodeChangesCard({patches, prStates, onCreatePR}: CodeChangesCardProps) {
  const mergedPatches = mergeFilePatches(patches);

  // Group by repo
  const patchesByRepo = new Map<string, ExplorerFilePatch[]>();
  for (const patch of mergedPatches) {
    const existing = patchesByRepo.get(patch.repo_name) || [];
    existing.push(patch);
    patchesByRepo.set(patch.repo_name, existing);
  }

  return (
    <ArtifactCard title={t('Code Changes')} icon={<IconCode size="md" color="blue400" />}>
      {Array.from(patchesByRepo.entries()).map(([repoName, repoPatches]) => {
        const prState = prStates?.[repoName];
        const hasPR = prState?.pr_url;
        const isCreatingPR = prState?.pr_creation_status === 'creating';

        return (
          <RepoSection key={repoName}>
            <RepoHeader>
              <RepoName>{repoName}</RepoName>
              {hasPR ? (
                <PRLink href={prState.pr_url} target="_blank" rel="noopener noreferrer">
                  {t('View PR #%s', prState.pr_number)}
                </PRLink>
              ) : onCreatePR ? (
                <Button
                  size="xs"
                  onClick={() => onCreatePR(repoName)}
                  disabled={isCreatingPR}
                >
                  {isCreatingPR ? t('Creating PR...') : t('Create PR')}
                </Button>
              ) : null}
            </RepoHeader>

            {repoPatches.map((patch, index) => (
              <DiffViewContainer key={`${patch.patch.path}-${index}`}>
                <FileDiffViewer patch={patch.patch} showBorder />
              </DiffViewContainer>
            ))}
          </RepoSection>
        );
      })}
    </ArtifactCard>
  );
}

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
    background-color: ${p => p.theme.backgroundSecondary};
  }
  color: ${p => p.theme.subText};
  background-color: ${p => p.theme.background};
`;

const TreeSpacer = styled('div')<{hasStem: boolean; spacerCount: number}>`
  grid-column: span 1;
  /* Allows TreeBranchIcons to appear connected vertically */
  border-right: 1px solid ${p => (p.hasStem ? p.theme.border : 'transparent')};
  margin-right: -1px;
  height: 100%;
  width: ${p => (p.spacerCount - 1) * 20 + 3}px;
`;

const TreeBranchIcon = styled('div')`
  border: 1px solid ${p => p.theme.border};
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
  font-size: ${p => p.theme.fontSize.sm};
  word-break: break-word;
  grid-column: span 1;
  color: ${p => p.theme.textColor};
`;

const TreeKey = styled(TreeValue)`
  color: ${p => p.theme.textColor};
`;

const ImpactTreeKey = styled(TreeKey)`
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const ImpactTreeKeyContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
`;

const TreeSubValue = styled(TreeValue)`
  color: ${p => p.theme.subText};
`;

const RepoName = styled('span')`
  color: ${p => p.theme.subText};
`;

const RepoSection = styled('div')`
  &:not(:last-child) {
    margin-bottom: ${p => p.theme.space['2xl']};
    padding-bottom: ${p => p.theme.space['2xl']};
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

const RepoHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${p => p.theme.space.xl};
`;

const PRLink = styled('a')`
  font-size: ${p => p.theme.fontSize.sm};
`;

const DiffViewContainer = styled('div')`
  margin-top: ${p => p.theme.space.md};

  &:not(:last-child) {
    margin-bottom: ${p => p.theme.space.xl};
  }
`;

const AnimatedCard = styled(motion.div)`
  transform-origin: top center;
`;
