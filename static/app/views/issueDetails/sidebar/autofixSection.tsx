import {useMemo} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  type AutofixSection,
  getAutofixArtifactFromSection,
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
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  CodeChangesPreview,
  CodingAgentPreview,
  PullRequestsPreview,
  RootCausePreview,
  SolutionPreview,
} from 'sentry/components/events/autofix/v3/autofixPreviews';
import {
  AutofixSetupCard,
  useAutofixSetupStep,
} from 'sentry/components/events/autofix/v3/autofixSetupCard';
import {AutofixStartCard} from 'sentry/components/events/autofix/v3/autofixStartCard';
import {useAutoTriggerAutofix} from 'sentry/components/events/autofix/v3/useAutoTriggerAutofix';
import {artifactToMarkdown} from 'sentry/components/events/autofix/v3/utils';
import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';
import {Placeholder} from 'sentry/components/placeholder';
import {IconSeer} from 'sentry/icons/iconSeer';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/foldSection';
import {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';
import type {AutofixContentProps} from 'sentry/views/issueDetails/sidebar/autofixSectionTypes';
import {Resources} from 'sentry/views/issueDetails/sidebar/resources';
import {useOpenSeerDrawer} from 'sentry/views/issueDetails/sidebar/seerDrawer';
import {Tab} from 'sentry/views/issueDetails/types';
import {useCurrentTab} from 'sentry/views/issueDetails/useGroupDetailsRoute';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

interface AutofixSectionProps {
  group: Group;
  project: Project;
}

export function AutofixSection({group, project}: AutofixSectionProps) {
  const aiConfig = useAiConfig(group, project);
  const isOnAutofixTab = useCurrentTab() === Tab.AUTOFIX;

  const issueTypeConfig = getConfigForIssueType(group, project);

  const issueTypeSupportsSeer =
    issueTypeConfig.autofix || issueTypeConfig.issueSummary.enabled;

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
          platform={group.platform}
          group={group}
        />
      </SidebarFoldSection>
    );
  }

  return (
    <SidebarFoldSection
      // The autofix tab already shows the full analysis, so start collapsed
      // there. Opening it on that tab shouldn't change the saved preference
      // for every other tab, and the key remounts it so each tab starts from
      // its own state.
      key={isOnAutofixTab ? 'autofix-tab' : 'default'}
      title={
        <Flex align="center" gap="xs">
          <Text size="md">{t('Seer Autofix')}</Text>
          <IconSeer />
        </Flex>
      }
      sectionKey={SectionKey.SEER}
      preventCollapse={false}
      initialCollapse={isOnAutofixTab}
      disableCollapsePersistence={isOnAutofixTab}
    >
      <AutofixQuotaContent aiConfig={aiConfig} group={group} project={project} />
    </SidebarFoldSection>
  );
}

export const AutofixQuotaContent = registerLLMContext(
  'autofix',
  OverrideOrDefault({
    overrideName: 'component:ai-configure-seer-quota-sidebar',
    defaultComponent: AutofixContent,
  })
);

export function AutofixContent({aiConfig, group, project}: AutofixContentProps) {
  const autofix = useExplorerAutofix(group);
  const {isPending, needOrgSetup, needProjSetup, setupType} = useAutofixSetupStep({
    seerReposLinked: aiConfig.seerReposLinked,
  });

  useAutoTriggerAutofix({autofix, group});

  const autofixContextData = useMemo(() => {
    if (!autofix.runState) {
      return null;
    }

    const data: Record<string, string> = {
      autofixStatus: autofix.runState.status,
    };

    const sections = getOrderedAutofixSections(autofix.runState);

    for (const section of sections) {
      const artifact = getAutofixArtifactFromSection(section);
      if (!artifact) {
        continue;
      }

      if (isCodeChangesArtifact(artifact)) {
        // Summarize code changes as file names only to avoid bloating context with full diffs
        const filesByRepo: Record<string, string[]> = {};
        for (const filePatch of artifact) {
          const files = filesByRepo[filePatch.repo_name] ?? [];
          files.push(filePatch.patch.target_file);
          filesByRepo[filePatch.repo_name] = files;
        }
        const parts = Object.entries(filesByRepo).map(
          ([repo, files]) => `${repo}: ${files.join(', ')}`
        );
        data.codeChanges = parts.join('\n');
      } else {
        const md = artifactToMarkdown(artifact, 2);
        if (md) {
          if (isRootCauseSection(section)) {
            data.rootCause = md;
          } else if (isSolutionSection(section)) {
            data.solution = md;
          } else if (isPullRequestsSection(section)) {
            data.pullRequests = md;
          } else if (isCodingAgentsSection(section)) {
            data.codingAgents = md;
          }
        }
      }
    }

    return data;
  }, [autofix.runState]);

  useLLMContext(autofixContextData);

  useRouteAnalyticsParams({
    seerNeedOrgSetup: isPending ? undefined : needOrgSetup,
    seerNeedProjSetup:
      isPending || aiConfig.isAutofixSetupLoading ? undefined : needProjSetup,
  });

  if (
    // waiting on the onboarding checks to load
    isPending ||
    // autofix results are loading
    autofix.isLoading ||
    // waiting for the ai configs to load
    aiConfig.isAutofixSetupLoading ||
    // we're polling and no blocks have been added yet
    (autofix.isPolling && !autofix.runState?.blocks?.length)
  ) {
    return <Placeholder height="160px" />;
  }

  if (setupType) {
    return <AutofixSetupCard group={group} project={project} setupType={setupType} />;
  }

  return <AutofixArtifacts autofix={autofix} group={group} project={project} />;
}

interface AutofixArtifactsProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  group: Group;
  project: Project;
}

function AutofixArtifacts({autofix, group, project}: AutofixArtifactsProps) {
  const sections = useMemo(
    () => getOrderedAutofixSections(autofix.runState),
    [autofix.runState]
  );

  const referrer = autofix.runState?.blocks?.[0]?.message?.metadata?.referrer;

  if (!sections.length) {
    return <AutofixEmptyState autofix={autofix} group={group} project={project} />;
  }

  return (
    <AutofixPreviews
      sections={sections}
      group={group}
      project={project}
      referrer={referrer}
    />
  );
}

interface AutofixEmptyStateProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  group: Group;
  project: Project;
}

function AutofixEmptyState({autofix, group, project}: AutofixEmptyStateProps) {
  const {openSeerDrawer} = useOpenSeerDrawer({
    group,
    project,
  });

  const referrer = autofix.runState?.blocks?.[0]?.message?.metadata?.referrer;

  return (
    <AutofixStartCard
      autofix={autofix}
      group={group}
      referrer={referrer}
      onStarted={openSeerDrawer}
    />
  );
}

interface AutofixPreviewsProps {
  group: Group;
  project: Project;
  sections: AutofixSection[];
  referrer?: string;
}

function AutofixPreviews({group, project, sections, referrer}: AutofixPreviewsProps) {
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

  const {openSeerDrawer} = useOpenSeerDrawer({
    group,
    project,
  });

  // On the autofix tab the full analysis is already open beside this sidebar,
  // so a button whose only job is to go there has nowhere to take you. The
  // previews above it stay, since they double as a table of contents.
  const isOnAutofixTab = useCurrentTab() === Tab.AUTOFIX;

  return (
    <Stack gap="xl">
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
      {!isOnAutofixTab && (
        <Button
          size="md"
          icon={<IconSeer />}
          aria-label={t('Open Autofix')}
          variant="primary"
          onClick={openSeerDrawer}
          analyticsEventKey="issue_details.seer_opened"
          analyticsEventName="Issue Details: Seer Opened"
          analyticsParams={{
            group_id: group.id,
            has_streamlined_ui: true,
            autofix_exists: true,
            autofix_step_type: sections[sections.length - 1]?.step ?? null,
            has_root_cause: hasRootCause,
            has_solution: hasSolution,
            has_coded_solution: hasCodeChanges,
            has_pr: hasPullRequests,
            mode: 'explorer',
            referrer,
          }}
        >
          {t('Open Autofix')}
        </Button>
      )}
    </Stack>
  );
}
