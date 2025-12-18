import {useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import autofixSetupImg from 'sentry-images/features/autofix-setup.svg';

import {Button} from 'sentry/components/core/button';
import {Text} from 'sentry/components/core/text';
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
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

import {SeerSectionCtaButton} from './seerSectionCtaButton';

function SeerWelcomeEntrypoint() {
  return (
    <WelcomeContainer>
      <WelcomeTextContainer>
        <Text>{t('Meet Seer, the AI debugging agent.')}</Text>
      </WelcomeTextContainer>
      <WelcomeImageContainer>
        <img src={autofixSetupImg} alt="Seer AI debugging agent" />
      </WelcomeImageContainer>
      <WelcomeTextContainer>
        <Text>
          {t(
            'Find the root cause of the issue, and even open a PR to fix it, in minutes.'
          )}
        </Text>
      </WelcomeTextContainer>
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
  const hasStreamlinedUI = useHasStreamlinedUI();
  // We don't use this on the streamlined UI, since the section folds.
  const [isExpanded, setIsExpanded] = useState(false);

  const aiConfig = useAiConfig(group, project);
  const issueTypeConfig = getConfigForIssueType(group, project);

  const issueTypeDoesntHaveSeer =
    !issueTypeConfig.autofix && !issueTypeConfig.issueSummary;

  const organization = useOrganization();
  const removeConsentFlow = organization.features.includes('gen-ai-consent-flow-removal');
  const isExplorerEnabled =
    organization.features.includes('seer-explorer') &&
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
    if (
      (aiConfig.orgNeedsGenAiAcknowledgement ||
        (!removeConsentFlow && !aiConfig.hasAutofixQuota)) &&
      !aiConfig.isAutofixSetupLoading
    ) {
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
        <ResourcesWrapper isExpanded={hasStreamlinedUI ? true : isExpanded}>
          <ResourcesContent isExpanded={hasStreamlinedUI ? true : isExpanded}>
            <Resources
              configResources={issueTypeConfig.resources}
              eventPlatform={event?.platform}
              group={group}
            />
          </ResourcesContent>
          {!hasStreamlinedUI && (
            <ExpandButton onClick={() => setIsExpanded(!isExpanded)} size="zero">
              {isExpanded ? t('SHOW LESS') : t('READ MORE')}
            </ExpandButton>
          )}
        </ResourcesWrapper>
      );
    }

    return null;
  };

  return (
    <SidebarFoldSection
      title={titleComponent}
      sectionKey={SectionKey.SEER}
      preventCollapse={!hasStreamlinedUI}
    >
      <SeerSectionContainer>
        {renderSectionContent()}
        {event &&
          showCtaButton &&
          (isExplorerEnabled ? (
            <ExplorerSeerSectionCtaButton
              aiConfig={aiConfig}
              event={event}
              group={group}
              project={project}
              hasStreamlinedUI={hasStreamlinedUI}
            />
          ) : (
            <SeerSectionCtaButton
              aiConfig={aiConfig}
              event={event}
              group={group}
              project={project}
              hasStreamlinedUI={hasStreamlinedUI}
            />
          ))}
      </SeerSectionContainer>
    </SidebarFoldSection>
  );
}

const SeerSectionContainer = styled('div')`
  display: flex;
  flex-direction: column;
`;

const Summary = styled('div')`
  margin-bottom: ${space(0.5)};
  position: relative;
`;

const ResourcesWrapper = styled('div')<{isExpanded: boolean}>`
  position: relative;
  margin-bottom: ${space(1)};
`;

const ResourcesContent = styled('div')<{isExpanded: boolean}>`
  position: relative;
  max-height: ${p => (p.isExpanded ? 'none' : '68px')};
  overflow: hidden;
  padding-bottom: ${p => (p.isExpanded ? space(2) : 0)};

  ${p =>
    !p.isExpanded &&
    css`
      &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 40px;
        background: linear-gradient(transparent, ${p.theme.tokens.background.primary});
      }
    `}
`;

const ExpandButton = styled(Button)`
  position: absolute;
  bottom: -${space(1)};
  right: 0;
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.subText};
  border: none;
  box-shadow: none;

  &:hover {
    color: ${p => p.theme.colors.gray500};
  }
`;

const HeaderContainer = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
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

const WelcomeTextContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.sm};
`;
