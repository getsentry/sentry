import {useCallback, useMemo, type CSSProperties} from 'react';
import styled from '@emotion/styled';

import seerConfigConnectImg from 'sentry-images/spot/seer-config-connect-2.svg';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Image} from '@sentry/scraps/image';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  getOrderedAutofixSections,
  isCodeChangesArtifact,
  isCodeChangesSection,
  isCodingAgentsSection,
  isPullRequestsArtifact,
  isPullRequestsSection,
  isRootCauseArtifact,
  isRootCauseSection,
  isSolutionArtifact,
  isSolutionSection,
  useExplorerAutofix,
  type AutofixSection,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  CodeChangesPreview,
  CodingAgentPreview,
  PullRequestsPreview,
  RootCausePreview,
  SolutionPreview,
} from 'sentry/components/events/autofix/v3/autofixPreviews';
import {useAutotriggerAutofix} from 'sentry/components/events/autofix/v3/useAutotriggerAutofix';
import {useGroupSummaryData} from 'sentry/components/group/groupSummary';
import {HookOrDefault} from 'sentry/components/hookOrDefault';
import {Placeholder} from 'sentry/components/placeholder';
import {IconBug} from 'sentry/icons';
import {IconSeer} from 'sentry/icons/iconSeer';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSeerOnboardingCheck} from 'sentry/utils/useSeerOnboardingCheck';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';
import {Resources} from 'sentry/views/issueDetails/streamline/sidebar/resources';
import {useOpenSeerDrawer} from 'sentry/views/issueDetails/streamline/sidebar/seerDrawer';

interface AutofixSectionProps {
  group: Group;
  project: Project;
  event?: Event;
}

export function AutofixSection({group, project, event}: AutofixSectionProps) {
  const aiConfig = useAiConfig(group, project);

  const issueTypeConfig = getConfigForIssueType(group, project);

  const issueTypeSupportsSeer = Boolean(
    issueTypeConfig.autofix || issueTypeConfig.issueSummary
  );

  if (!aiConfig.areAiFeaturesAllowed || !issueTypeSupportsSeer) {
    if (!issueTypeConfig.resources) {
      return null;
    }

    return (
      <SidebarFoldSection
        title={
          <Flex>
            <Text size="md">{t('Resources')}</Text>
          </Flex>
        }
        sectionKey={SectionKey.SEER}
        preventCollapse={false}
      >
        <Resources
          configResources={issueTypeConfig.resources}
          eventPlatform={event?.platform}
          group={group}
        />
      </SidebarFoldSection>
    );
  }

  return (
    <SidebarFoldSection
      title={
        <Flex align="center" gap="xs">
          <Text size="md">{t('Seer')}</Text>
          <IconSeer />
        </Flex>
      }
      sectionKey={SectionKey.SEER}
      preventCollapse={false}
    >
      <AutofixContentHook
        aiConfig={aiConfig}
        group={group}
        project={project}
        event={event}
      />
    </SidebarFoldSection>
  );
}

const AutofixContentHook = HookOrDefault({
  hookName: 'component:ai-configure-seer-quota-sidebar',
  defaultComponent: AutofixContent,
});

export interface AutofixContentProps {
  aiConfig: ReturnType<typeof useAiConfig>;
  group: Group;
  project: Project;
  event?: Event;
}

export function AutofixContent({aiConfig, group, project, event}: AutofixContentProps) {
  const organization = useOrganization();
  const autofix = useExplorerAutofix(group.id);
  const {data: setupCheck, isPending} = useSeerOnboardingCheck();

  useAutotriggerAutofix({autofix, group});

  if (
    // waiting on the onboarding checks to load
    isPending ||
    // autofix results are loading
    autofix.isLoading ||
    // waiting for the event to load
    !event ||
    // waiting for the ai configs to load
    aiConfig.isAutofixSetupLoading ||
    // we're polling and no blocks have been added yet
    (autofix.isPolling && !autofix.runState?.blocks?.length)
  ) {
    return <Placeholder height="160px" />;
  }

  const needOrgSetup =
    // scm integration doesn't exist
    !setupCheck?.hasSupportedScmIntegration;

  const needProjSetup =
    // scm integration not linked to project
    !aiConfig.seerReposLinked ||
    // autofix setting not enabled
    !aiConfig.autofixEnabled;

  if (needOrgSetup || needProjSetup) {
    return (
      <Flex direction="column" border="muted" radius="md" padding="lg" gap="lg">
        <Text bold>{t('Finish Configuring Seer')}</Text>
        <Text>
          {t(
            'Your organization has access to Seer, which will allow you to run Autofix on your issues, but you aren’t getting the most out of it.'
          )}
        </Text>
        <Text>{t('Autofix can:')}</Text>
        <Container as="ol" margin="0">
          <li>{t('Determine the root cause of your issue and how to reproduce it')}</li>
          <li>{t('Propose a solution')}</li>
          <li>{t('Create a code fix')}</li>
        </Container>
        <Flex>
          {needOrgSetup ? (
            <LinkButton
              to={`/settings/${organization.slug}/seer/onboarding/`}
              icon={<IconSeer />}
            >
              {t('Set Up Seer')}
            </LinkButton>
          ) : needProjSetup ? (
            <LinkButton
              to={`/settings/${organization.slug}/projects/${project.slug}/seer/`}
              icon={<IconSeer />}
            >
              {t('Set Up Seer for This Project')}
            </LinkButton>
          ) : null}
        </Flex>
      </Flex>
    );
  }

  return (
    <AutofixArtifacts autofix={autofix} group={group} project={project} event={event} />
  );
}

interface AutofixArtifactsProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  event: Event;
  group: Group;
  project: Project;
}

function AutofixArtifacts({autofix, group, project, event}: AutofixArtifactsProps) {
  const sections = useMemo(
    () => getOrderedAutofixSections(autofix.runState),
    [autofix.runState]
  );

  const referrer = autofix.runState?.blocks?.[0]?.message?.metadata?.referrer;

  if (!sections.length) {
    return (
      <AutofixEmptyState
        autofix={autofix}
        event={event}
        group={group}
        project={project}
        referrer={referrer}
      />
    );
  }

  return (
    <AutofixPreviews
      sections={sections}
      event={event}
      group={group}
      project={project}
      referrer={referrer}
    />
  );
}

interface AutofixEmptyStateProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  event: Event;
  group: Group;
  project: Project;
  referrer?: string;
}

function AutofixEmptyState({
  autofix,
  group,
  event,
  project,
  referrer,
}: AutofixEmptyStateProps) {
  const {openSeerDrawer} = useOpenSeerDrawer({
    group,
    project,
    event,
  });

  // extract startStep first here so we can depend on it directly as `autofix` itself is unstable.
  const startStep = autofix.startStep;

  const handleStartRootCause = useCallback(() => {
    startStep('root_cause');
    openSeerDrawer();
  }, [startStep, openSeerDrawer]);

  return (
    <Flex direction="column" gap="md">
      <Flex
        border="muted"
        radius="md"
        padding="lg"
        gap="lg"
        align="center"
        justify="between"
      >
        <Container>
          <Text>{t('Have Seer...')}</Text>
          <Container as="ol" margin="0">
            <li>{t('Determine the root cause of your issue')}</li>
            <li>{t('Outline a plan')}</li>
            <li>{t('Create a code fix')}</li>
          </Container>
        </Container>
        <ImageContainer
          justify="end"
          align="center"
          aspectRatio="9 / 16"
          height={{'2xs': '78px', lg: '98px'}}
        >
          <Image src={seerConfigConnectImg} alt="" width="auto" height="100%" />
        </ImageContainer>
      </Flex>
      <Button
        size="md"
        icon={<IconBug />}
        aria-label={t('Start Analysis')}
        tooltipProps={{title: t('Start Analysis')}}
        priority="primary"
        onClick={handleStartRootCause}
        analyticsEventKey="autofix.start_fix_clicked"
        analyticsEventName="Autofix: Start Fix Clicked"
        analyticsParams={{group_id: group.id, mode: 'explorer', referrer}}
      >
        {t('Start Analysis')}
      </Button>
    </Flex>
  );
}

interface AutofixPreviewsProps {
  event: Event;
  group: Group;
  project: Project;
  sections: AutofixSection[];
  referrer?: string;
}

function AutofixPreviews({
  event,
  group,
  project,
  sections,
  referrer,
}: AutofixPreviewsProps) {
  const hasRootCause =
    sections.findLast(isRootCauseSection)?.artifacts?.some(isRootCauseArtifact) ?? false;

  const hasSolution =
    sections.findLast(isSolutionSection)?.artifacts?.some(isSolutionArtifact) ?? false;

  const hasCodeChanges =
    sections.findLast(isCodeChangesSection)?.artifacts?.some(isCodeChangesArtifact) ??
    false;
  const hasPullRequests =
    sections.findLast(isPullRequestsSection)?.artifacts?.some(isPullRequestsArtifact) ??
    false;

  // Track autofix features analytics
  useRouteAnalyticsParams({
    has_root_cause: hasRootCause,
    has_solution: hasSolution,
    has_coded_solution: hasCodeChanges,
    has_pr: hasPullRequests,
    autofix_mode: 'explorer',
    autofix_referrer: referrer,
  });

  const {data: summaryData, isPending: isSummaryPending} = useGroupSummaryData(group);

  const {openSeerDrawer} = useOpenSeerDrawer({
    group,
    project,
    event,
  });

  return (
    <Flex direction="column" gap="xl">
      {sections.map(section => {
        // there should only be 1 section of each type
        if (isRootCauseSection(section)) {
          return <RootCausePreview key="root-cause" section={section} />;
        }

        if (isSolutionSection(section)) {
          return <SolutionPreview key="solution" section={section} />;
        }

        if (isCodeChangesSection(section)) {
          return <CodeChangesPreview key="code-changes" section={section} />;
        }

        if (isPullRequestsSection(section)) {
          return <PullRequestsPreview key="pull-requests" section={section} />;
        }

        if (isCodingAgentsSection(section)) {
          return <CodingAgentPreview key="coding-agent" section={section} />;
        }

        // TODO: maybe send a log?
        return null;
      })}
      <Button
        size="md"
        icon={<IconSeer />}
        aria-label={t('Open Seer')}
        tooltipProps={{title: t('Open Seer')}}
        priority="primary"
        onClick={openSeerDrawer}
        analyticsEventKey="issue_details.seer_opened"
        analyticsEventName="Issue Details: Seer Opened"
        analyticsParams={{
          group_id: group.id,
          has_streamlined_ui: true,
          autofix_exists: true,
          autofix_step_type: sections[sections.length - 1]?.step ?? null,
          has_summary: Boolean(summaryData && !isSummaryPending),
          has_root_cause: hasRootCause,
          has_solution: hasSolution,
          has_coded_solution: hasCodeChanges,
          has_pr: hasPullRequests,
          mode: 'explorer',
          referrer,
        }}
      >
        {t('Open Seer')}
      </Button>
    </Flex>
  );
}

const ImageContainer = styled(Flex)<{
  aspectRatio?: CSSProperties['aspectRatio'];
}>`
  ${p => p.aspectRatio && `aspect-ratio: ${p.aspectRatio}`};
`;
