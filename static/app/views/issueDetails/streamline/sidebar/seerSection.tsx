import {useMemo} from 'react';
import styled from '@emotion/styled';

import autofixSetupImg from 'sentry-images/features/autofix-setup.svg';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  getArtifactsFromBlocks,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {ExplorerArtifactPreviews} from 'sentry/components/events/autofix/v2/artifactPreviews';
import {ExplorerSeerSectionCtaButton} from 'sentry/components/events/autofix/v2/autofixSidebarCtaButton';
import {GroupSummary} from 'sentry/components/group/groupSummary';
import {GroupSummaryWithAutofix} from 'sentry/components/group/groupSummaryWithAutofix';
import Placeholder from 'sentry/components/placeholder';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';
import Resources from 'sentry/views/issueDetails/streamline/sidebar/resources';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

import {SeerSectionCtaButton} from './seerSectionCtaButton';

function SeerWelcomeEntrypoint() {
  return (
    <WelcomeContainer>
      <Stack gap="sm">
        <Text>{t('Meet Seer, the AI debugging agent.')}</Text>
      </Stack>
      <WelcomeImageContainer>
        <img src={autofixSetupImg} alt="Seer AI debugging agent" />
      </WelcomeImageContainer>
      <Stack gap="sm">
        <Text>
          {t(
            'Find the root cause of the issue, and even open a PR to fix it, in minutes.'
          )}
        </Text>
      </Stack>
    </WelcomeContainer>
  );
}

function SeerSectionContent({
  group,
  project,
  event,
  isExplorerEnabled,
}: {
  event: Event | undefined;
  group: Group;
  isExplorerEnabled: boolean;
  project: Project;
}) {
  const aiConfig = useAiConfig(group, project);

  if (!event && !aiConfig.isAutofixSetupLoading) {
    return <StyledP>{t('No event to analyze.')}</StyledP>;
  }
  if (!event || aiConfig.isAutofixSetupLoading) {
    return <Placeholder height="160px" />;
  }

  if (aiConfig.hasSummary) {
    if (aiConfig.hasAutofix && !isExplorerEnabled) {
      return (
        <Summary>
          <GroupSummaryWithAutofix
            group={group}
            event={event}
            project={project}
            preview
          />
        </Summary>
      );
    }

    return (
      <Summary>
        <GroupSummary group={group} event={event} project={project} preview />
      </Summary>
    );
  }

  return null;
}

export default function SeerSection({
  group,
  project,
  event,
}: {
  event: Event | undefined;
  group: Group;
  project: Project;
}) {
  const aiConfig = useAiConfig(group, project);
  const issueTypeConfig = getConfigForIssueType(group, project);

  const issueTypeDoesntHaveSeer =
    !issueTypeConfig.autofix && !issueTypeConfig.issueSummary;

  const organization = useOrganization();
  const isExplorerEnabled =
    isSeerExplorerEnabled(organization) &&
    organization.features.includes('autofix-on-explorer');

  // Get explorer artifacts when autofix-on-explorer is enabled
  const {runState: explorerRunState} = useExplorerAutofix(group.id, {
    enabled: isExplorerEnabled,
  });
  const explorerArtifacts = useMemo(
    () =>
      isExplorerEnabled ? getArtifactsFromBlocks(explorerRunState?.blocks ?? []) : {},
    [isExplorerEnabled, explorerRunState?.blocks]
  );
  const hasExplorerArtifacts = Object.keys(explorerArtifacts).length > 0;

  if (
    (!aiConfig.areAiFeaturesAllowed || issueTypeDoesntHaveSeer) &&
    !aiConfig.hasResources
  ) {
    return null;
  }

  const showCtaButton =
    aiConfig.orgNeedsGenAiAcknowledgement ||
    aiConfig.hasAutofix ||
    (aiConfig.hasSummary && aiConfig.hasResources);

  const onlyHasResources =
    issueTypeDoesntHaveSeer ||
    (!aiConfig.orgNeedsGenAiAcknowledgement &&
      !aiConfig.hasSummary &&
      !aiConfig.hasAutofix &&
      aiConfig.hasResources);

  const titleComponent = onlyHasResources ? (
    <HeaderContainer>{t('Resources')}</HeaderContainer>
  ) : (
    <HeaderContainer>
      {t('Seer')}
      <IconSeer />
    </HeaderContainer>
  );

  // Determine what content to show in the section body
  const renderSectionContent = () => {
    // Welcome entrypoint for orgs that need consent
    if (aiConfig.orgNeedsGenAiAcknowledgement && !aiConfig.isAutofixSetupLoading) {
      return <SeerWelcomeEntrypoint />;
    }

    // When explorer is enabled and has artifacts, show artifact previews
    if (isExplorerEnabled && hasExplorerArtifacts) {
      return (
        <ExplorerArtifactPreviews
          artifacts={explorerArtifacts}
          blocks={explorerRunState?.blocks ?? []}
          prStates={explorerRunState?.repo_pr_states}
        />
      );
    }

    // Default: show group summary
    if (aiConfig.hasAutofix || aiConfig.hasSummary) {
      return (
        <SeerSectionContent
          group={group}
          project={project}
          event={event}
          isExplorerEnabled={isExplorerEnabled}
        />
      );
    }

    // Resources only
    if (issueTypeConfig.resources) {
      return (
        <ResourcesWrapper>
          <ResourcesContent>
            <Resources
              configResources={issueTypeConfig.resources}
              eventPlatform={event?.platform}
              group={group}
            />
          </ResourcesContent>
        </ResourcesWrapper>
      );
    }

    return null;
  };

  return (
    <SidebarFoldSection
      title={titleComponent}
      sectionKey={SectionKey.SEER}
      preventCollapse={false}
    >
      <Stack>
        {renderSectionContent()}
        {event &&
          showCtaButton &&
          (isExplorerEnabled ? (
            <ExplorerSeerSectionCtaButton
              aiConfig={aiConfig}
              event={event}
              group={group}
              project={project}
              hasStreamlinedUI
            />
          ) : (
            <SeerSectionCtaButton
              aiConfig={aiConfig}
              event={event}
              group={group}
              project={project}
              hasStreamlinedUI
            />
          ))}
      </Stack>
    </SidebarFoldSection>
  );
}

const Summary = styled('div')`
  margin-bottom: ${p => p.theme.space.xs};
  position: relative;
`;

const ResourcesWrapper = styled('div')`
  position: relative;
  margin-bottom: ${p => p.theme.space.md};
`;

const ResourcesContent = styled('div')`
  position: relative;
  padding-bottom: ${space(2)};
`;

const HeaderContainer = styled('div')`
  font-size: ${p => p.theme.font.size.md};
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
`;

const StyledP = styled('p')`
  margin-bottom: ${p => p.theme.space.md};
`;

const WelcomeContainer = styled('div')`
  margin-bottom: ${p => p.theme.space.lg};
`;

const WelcomeImageContainer = styled('div')`
  margin-bottom: ${p => p.theme.space.lg};
  margin-top: ${p => p.theme.space.lg};

  img {
    max-width: 100%;
    height: auto;
  }
`;
