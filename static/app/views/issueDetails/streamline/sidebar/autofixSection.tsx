import {useMemo} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  getOrderedAutofixArtifacts,
  isRootCauseArtifact,
  isSolutionArtifact,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  CodeChangesPreview,
  PullRequestsPreview,
  RootCausePreview,
  SolutionPreview,
} from 'sentry/components/events/autofix/v3/autofixPreviews';
import {GroupSummary} from 'sentry/components/group/groupSummary';
import Placeholder from 'sentry/components/placeholder';
import {IconSeer} from 'sentry/icons/iconSeer';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {isArrayOf} from 'sentry/types/utils';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import type {IssueTypeConfig} from 'sentry/utils/issueTypeConfig/types';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';
import Resources from 'sentry/views/issueDetails/streamline/sidebar/resources';
import {isExplorerFilePatch, isRepoPRState} from 'sentry/views/seerExplorer/types';

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
      <AutofixContent
        aiConfig={aiConfig}
        issueTypeConfig={issueTypeConfig}
        group={group}
        project={project}
        event={event}
      />
    </SidebarFoldSection>
  );
}

interface AutofixContentProps {
  aiConfig: ReturnType<typeof useAiConfig>;
  group: Group;
  issueTypeConfig: IssueTypeConfig;
  project: Project;
  event?: Event;
}

function AutofixContent({
  aiConfig,
  group,
  issueTypeConfig,
  project,
  event,
}: AutofixContentProps) {
  const autofix = useExplorerAutofix(group.id);
  const artifacts = useMemo(
    () => getOrderedAutofixArtifacts(autofix.runState),
    [autofix.runState]
  );

  if (autofix.isLoading) {
    return <Placeholder height="160px" />;
  }

  if (artifacts.length) {
    return (
      <Flex direction="column" gap="xl">
        {artifacts.map(artifact => {
          // there should only be 1 artifact of each type
          if (isRootCauseArtifact(artifact)) {
            return <RootCausePreview key="root-cause" artifact={artifact} />;
          }

          if (isSolutionArtifact(artifact)) {
            return <SolutionPreview key="solution" artifact={artifact} />;
          }

          if (isArrayOf(artifact, isExplorerFilePatch)) {
            return <CodeChangesPreview key="code-changes" artifact={artifact} />;
          }

          if (isArrayOf(artifact, isRepoPRState)) {
            return <PullRequestsPreview key="pull-requests" artifact={artifact} />;
          }

          // TODO: maybe send a log?
          return null;
        })}
      </Flex>
    );
  }

  if (aiConfig.hasSummary) {
    return <GroupSummary group={group} event={event} project={project} preview />;
  }

  if (issueTypeConfig.resources) {
    return (
      <Resources
        configResources={issueTypeConfig.resources}
        eventPlatform={event?.platform}
        group={group}
      />
    );
  }

  return null;
}
