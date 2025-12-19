import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Container, Flex} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Heading} from '@sentry/scraps/text';

import {assignToActor} from 'sentry/actionCreators/group';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {CommitRow} from 'sentry/components/commitRow';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Button} from 'sentry/components/core/button';
import {Text} from 'sentry/components/core/text';
import {useOrganizationRepositories} from 'sentry/components/events/autofix/preferences/hooks/useOrganizationRepositories';
import type {
  ImpactAssessmentArtifact,
  ImpactItem,
  RootCauseArtifact,
  SolutionArtifact,
  SuspectCommit,
  TriageArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  cardAnimationProps,
  StyledMarkedText,
} from 'sentry/components/events/autofix/v2/utils';
import {
  AssigneeSelector,
  useHandleAssigneeChange,
} from 'sentry/components/group/assigneeSelector';
import Panel from 'sentry/components/panels/panel';
import {Timeline} from 'sentry/components/timeline';
import {
  IconCheckmark,
  IconChevron,
  IconCircle,
  IconCode,
  IconFatal,
  IconFire,
  IconFix,
  IconFocus,
  IconGroup,
  IconUser,
  IconWarning,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Commit} from 'sentry/types/integrations';
import type {Member, Organization} from 'sentry/types/organization';
import type {AvatarUser} from 'sentry/types/user';
import {useApiQuery} from 'sentry/utils/queryClient';
import {FileDiffViewer} from 'sentry/views/seerExplorer/fileDiffViewer';
import type {ExplorerFilePatch, RepoPRState} from 'sentry/views/seerExplorer/types';

export type ArtifactData = Record<string, unknown>;

/**
 * Get the colored icon for an artifact type.
 * Shared utility for consistent icon styling across artifact displays.
 */
export function getArtifactIcon(
  artifactType:
    | 'root_cause'
    | 'solution'
    | 'impact_assessment'
    | 'triage'
    | 'code_changes',
  size: 'xs' | 'sm' | 'md' | 'lg' = 'md'
): React.ReactNode {
  switch (artifactType) {
    case 'root_cause':
      return <IconFocus size={size} color="pink400" />;
    case 'solution':
      return <IconFix size={size} color="success" />;
    case 'impact_assessment':
      return <IconFire size={size} color="error" />;
    case 'triage':
      return <IconGroup size={size} color="blue400" />;
    case 'code_changes':
      return <IconCode size={size} color="blue400" />;
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
          <TreeKey as="div">
            <StyledMarkedText text={why} inline as="span" />
          </TreeKey>
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
            <ImpactTreeKey as="div">
              <StyledMarkedText text={title} inline as="span" />
            </ImpactTreeKey>
            {showIcon && icon}
          </ImpactTreeKeyContainer>
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
 * Renders an impact item in a tree structure with label as key, description as value, and evidence as sub-value.
 */
function ImpactTreeRow({
  impact,
  spacerCount = 0,
}: {
  impact: ImpactItem;
  spacerCount?: number;
}) {
  // Only low-rated items are collapsible
  const isCollapsible = impact.rating === 'low';
  const [isExpanded, setIsExpanded] = useState(!isCollapsible);

  const getSeverityIcon = () => {
    if (impact.rating === 'high') {
      return <IconFatal size="xs" color="error" />;
    }
    if (impact.rating === 'medium') {
      return <IconWarning size="xs" color="warning" />;
    }
    if (impact.rating === 'low') {
      return <IconCheckmark size="xs" color="success" />;
    }
    return null;
  };

  const hasSubItems = impact.impact_description || impact.evidence;
  const showSubItems = !isCollapsible || isExpanded;

  const handleToggle = () => {
    if (isCollapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <Fragment>
      {/* Label as key */}
      <TreeRow
        as={isCollapsible ? 'div' : undefined}
        onClick={isCollapsible ? handleToggle : undefined}
        role={isCollapsible ? 'button' : undefined}
        tabIndex={isCollapsible ? 0 : undefined}
        onKeyDown={
          isCollapsible
            ? e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggle();
                }
              }
            : undefined
        }
        $isClickable={isCollapsible}
      >
        <TreeKeyTrunk spacerCount={spacerCount}>
          {spacerCount > 0 && (
            <Fragment>
              <TreeSpacer spacerCount={spacerCount} hasStem={false} />
              <TreeBranchIcon />
            </Fragment>
          )}
          <ImpactTreeKeyContainer>
            {isCollapsible && hasSubItems && (
              <IconChevron size="xs" direction={isExpanded ? 'down' : 'right'} />
            )}
            <ImpactTreeKey as="div">
              <StyledMarkedText text={impact.label} inline as="span" />
            </ImpactTreeKey>
            {getSeverityIcon()}
          </ImpactTreeKeyContainer>
        </TreeKeyTrunk>
      </TreeRow>

      {/* Description as value */}
      {showSubItems && (
        <TreeRow>
          <TreeKeyTrunk spacerCount={spacerCount + 1}>
            <TreeSpacer spacerCount={spacerCount + 1} hasStem={false} />
            <TreeBranchIcon />
            <TreeValue as="div">
              <StyledMarkedText text={impact.impact_description} inline as="span" />
            </TreeValue>
          </TreeKeyTrunk>
        </TreeRow>
      )}

      {/* Evidence as sub-value */}
      {showSubItems && impact.evidence && (
        <TreeRow>
          <TreeKeyTrunk spacerCount={spacerCount + 2}>
            <TreeSpacer spacerCount={spacerCount + 2} hasStem={false} />
            <TreeBranchIcon />
            <TreeSubValue as="div">
              <StyledMarkedText text={impact.evidence} inline as="span" />
            </TreeSubValue>
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

  // Sort impacts by rating: high > medium > low
  const sortedImpacts = [...impacts].sort((a, b) => {
    const ratingOrder: Record<'high' | 'medium' | 'low', number> = {
      high: 0,
      medium: 1,
      low: 2,
    };
    return ratingOrder[a.rating] - ratingOrder[b.rating];
  });

  return (
    <TreeContainer columnCount={0}>
      {sortedImpacts.map((impact, index) => (
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
    <ArtifactCard title={t('Root Cause')} icon={getArtifactIcon('root_cause')}>
      <Text size="lg" as="div">
        <StyledMarkedText text={typedData.one_line_description} inline as="span" />
      </Text>

      {typedData.five_whys.length > 0 && <FiveWhysTree whys={typedData.five_whys} />}

      {typedData.reproduction_steps && typedData.reproduction_steps.length > 0 && (
        <Flex direction="column" gap="sm">
          <Text size="sm" bold>
            {t('Reproduction Steps')}
          </Text>
          <Timeline.Container>
            {typedData.reproduction_steps.map((step, index) => (
              <DenseTimelineItem
                key={index}
                icon={<IconCircle size="xs" />}
                title={
                  <NonBoldTitle size="sm" as="div">
                    <StyledMarkedText text={step} inline as="span" />
                  </NonBoldTitle>
                }
              />
            ))}
          </Timeline.Container>
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
    <ArtifactCard title={t('Solution')} icon={getArtifactIcon('solution')}>
      <Text size="lg" as="div">
        <StyledMarkedText text={typedData.one_line_summary} inline as="span" />
      </Text>

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
    <ArtifactCard title={t('Impact')} icon={getArtifactIcon('impact_assessment')}>
      <Text size="lg" as="div">
        <StyledMarkedText text={typedData.one_line_description} inline as="span" />
      </Text>

      {typedData.impacts.length > 0 && <ImpactTree impacts={typedData.impacts} />}
    </ArtifactCard>
  );
}

interface TriageCardProps {
  data: ArtifactData;
  group: Group;
  organization: Organization;
}

/**
 * Hook to look up a Sentry member by email, falling back to name.
 */
function useMemberLookup(organization: Organization, email?: string, name?: string) {
  // Try matching by email first
  const {data: memberDataByEmail} = useApiQuery<Member[]>(
    email
      ? [
          `/organizations/${organization.slug}/members/`,
          {query: {query: `email:${email}`}},
        ]
      : [''],
    {
      enabled: !!email,
      staleTime: 0,
    }
  );

  // If no email match, try matching by name
  const shouldTryNameMatch = name && !memberDataByEmail?.length;
  const {data: memberDataByName} = useApiQuery<Member[]>(
    shouldTryNameMatch
      ? [`/organizations/${organization.slug}/members/`, {query: {query: name}}]
      : [''],
    {
      enabled: !!shouldTryNameMatch,
      staleTime: 0,
    }
  );

  const member = memberDataByEmail?.[0] || memberDataByName?.[0];
  return member?.user;
}

/**
 * Build a Commit object from suspect commit data for use with CommitRow.
 */
function useSuspectCommitData(
  suspectCommit: SuspectCommit | null | undefined,
  organization: Organization
): Commit | null {
  const {data: repositories} = useOrganizationRepositories();

  // Look up commit author in Sentry members
  const authorUser = useMemberLookup(
    organization,
    suspectCommit?.author_email,
    suspectCommit?.author_name
  );

  return useMemo((): Commit | null => {
    if (!suspectCommit) {
      return null;
    }

    // Find matching repository by name
    const repository = repositories?.find(repo => repo.name === suspectCommit.repo_name);

    // Build author - use Sentry user if matched, otherwise create a minimal author object
    // CommitRow only uses name/email/id with optional chaining, so this is safe
    const author =
      authorUser ??
      ({
        name: suspectCommit.author_name,
        email: suspectCommit.author_email,
      } as Commit['author']);

    return {
      id: suspectCommit.sha,
      message: suspectCommit.message,
      dateCreated: suspectCommit.committed_date,
      releases: [],
      author,
      repository,
    };
  }, [suspectCommit, repositories, authorUser]);
}

/**
 * Triage artifact card.
 */
export function TriageCard({data, group, organization}: TriageCardProps) {
  const typedData = data as unknown as TriageArtifact;
  const hasSuspect = typedData.suspect_commit;
  const hasAssignee = typedData.suggested_assignee;
  const [isAssigning, setIsAssigning] = useState(false);

  const {handleAssigneeChange, assigneeLoading} = useHandleAssigneeChange({
    group,
    organization,
  });

  const commit = useSuspectCommitData(typedData.suspect_commit, organization);

  const assigneeUser = useMemberLookup(
    organization,
    typedData.suggested_assignee?.email,
    typedData.suggested_assignee?.name
  );

  const handleAssign = async () => {
    if (!assigneeUser) {
      addErrorMessage(t('Unable to find user to assign'));
      return;
    }

    setIsAssigning(true);
    try {
      await assignToActor({
        id: group.id,
        orgSlug: organization.slug,
        actor: {id: String(assigneeUser.id), type: 'user'},
        assignedBy: 'suggested_assignee',
      });
      addSuccessMessage(t('Issue assigned successfully'));
    } catch (error) {
      addErrorMessage(t('Failed to assign issue'));
    } finally {
      setIsAssigning(false);
    }
  };

  // Create a minimal user object for avatar display
  // Use the email from Sentry's member data (assigneeUser.email) instead of the AI-suggested email
  const userForAvatar: AvatarUser | undefined = assigneeUser
    ? {
        email: assigneeUser.email,
        name: typedData.suggested_assignee?.name || assigneeUser.email,
        id: assigneeUser.id,
        username: assigneeUser.username || assigneeUser.email.split('@')[0] || '',
        ip_address: '',
      }
    : undefined;

  const hasAssigneeMatch = !!assigneeUser;

  if (!hasSuspect && !hasAssignee) {
    return (
      <ArtifactCard title={t('Triage')} icon={getArtifactIcon('triage')}>
        <Text variant="muted">{t('No triage information available.')}</Text>
      </ArtifactCard>
    );
  }

  return (
    <ArtifactCard title={t('Triage')} icon={getArtifactIcon('triage')}>
      <Flex direction="column" gap="sm">
        {hasSuspect && commit && (
          <Flex direction="column" gap="lg">
            <Flex direction="column" gap="xl">
              <SuspectCommitPanel>
                <CommitRow commit={commit} />
                {typedData.suspect_commit?.description && (
                  <Container padding="lg" paddingTop="0">
                    <Text size="sm" variant="muted">
                      <StyledMarkedText
                        text={typedData.suspect_commit.description}
                        inline
                        as="span"
                      />
                    </Text>
                  </Container>
                )}
              </SuspectCommitPanel>
            </Flex>
          </Flex>
        )}

        {hasSuspect && hasAssignee && (
          <Container paddingBottom="lg">
            <Separator orientation="horizontal" border="primary" />
          </Container>
        )}

        {hasAssignee && (
          <Flex direction="column" gap="lg">
            <Container>
              <Flex direction="column" gap="xl">
                <SuspectCommitPanel>
                  <Container padding="md" paddingTop="0" paddingBottom="0">
                    <Flex justify="between">
                      <Flex align="center" gap="md" paddingLeft="xs">
                        {hasAssigneeMatch && userForAvatar ? (
                          <UserAvatar user={userForAvatar} size={24} gravatar />
                        ) : (
                          <IconUser size="md" color="gray400" />
                        )}
                        <Flex direction="column" gap="xs">
                          <Text size="lg">{typedData.suggested_assignee?.name}</Text>
                        </Flex>
                      </Flex>
                    </Flex>

                    {typedData.suggested_assignee?.why && (
                      <Container
                        padding="md"
                        paddingTop="lg"
                        paddingBottom="lg"
                        paddingLeft="xs"
                      >
                        <Text size="sm" variant="muted">
                          <StyledMarkedText
                            text={typedData.suggested_assignee.why}
                            inline
                            as="span"
                          />
                        </Text>
                      </Container>
                    )}

                    <Flex justify="end">
                      {hasAssigneeMatch ? (
                        <Button size="sm" onClick={handleAssign} disabled={isAssigning}>
                          {isAssigning
                            ? t('Assigning...')
                            : t(
                                'Assign to %s',
                                typedData.suggested_assignee?.name.split(' ')[0]
                              )}
                        </Button>
                      ) : (
                        <AssigneeSelector
                          group={group}
                          assigneeLoading={assigneeLoading}
                          handleAssigneeChange={handleAssigneeChange}
                          showLabel
                        />
                      )}
                    </Flex>
                  </Container>
                </SuspectCommitPanel>
              </Flex>
            </Container>
          </Flex>
        )}
      </Flex>
    </ArtifactCard>
  );
}

const SuspectCommitPanel = styled(Panel)`
  line-height: 1.2;
  border: none;
  margin: 0;
`;

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
        const hasPR = prState?.pr_url;
        const isCreatingPR = prState?.pr_creation_status === 'creating';

        return (
          <RepoSection key={repoName}>
            <RepoHeader>
              <RepoName>{repoName}</RepoName>
              {hasPR ? (
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
            </RepoHeader>

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

const TreeContainer = styled('div')<{columnCount: number}>`
  display: grid;
  grid-template-columns: repeat(${p => p.columnCount}, 1fr);
  align-items: start;
  white-space: normal;
`;

const TreeRow = styled('div')<{$isClickable?: boolean}>`
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
  ${p =>
    p.$isClickable &&
    `
    cursor: pointer;

    &:hover {
      background-color: ${p.theme.hover};
    }
  `}
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
  color: ${p => p.theme.tokens.content.primary};
`;

const TreeKey = styled(TreeValue)`
  color: ${p => p.theme.tokens.content.primary};
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

const SolutionTreeValue = styled(TreeValue)`
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

const AnimatedCard = styled(motion.div)`
  transform-origin: top center;
`;

const NonBoldTitle = styled(Text)`
  font-weight: ${p => p.theme.fontWeight.normal};
  margin-top: ${p => p.theme.space.xs};
`;

const DenseTimelineItem = styled(Timeline.Item)`
  margin: 0;
`;
