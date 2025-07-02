import {useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
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
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';
import Resources from 'sentry/views/issueDetails/streamline/sidebar/resources';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

import {SeerSectionCtaButton} from './seerSectionCtaButton';

function SeerSectionContent({
  group,
  project,
  event,
}: {
  event: Event | undefined;
  group: Group;
  project: Project;
}) {
  const aiConfig = useAiConfig(group, project);

  if (!event || aiConfig.isAutofixSetupLoading) {
    return <Placeholder height="160px" />;
  }

  if (aiConfig.hasSummary) {
    if (aiConfig.hasAutofix) {
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

  if (
    (!aiConfig.areAiFeaturesAllowed || issueTypeDoesntHaveSeer) &&
    !aiConfig.hasResources
  ) {
    return null;
  }

  const showCtaButton =
    aiConfig.needsGenAiAcknowledgement ||
    aiConfig.hasAutofix ||
    (aiConfig.hasSummary && aiConfig.hasResources);

  const onlyHasResources =
    issueTypeDoesntHaveSeer ||
    (!aiConfig.needsGenAiAcknowledgement &&
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

  return (
    <SidebarFoldSection
      title={titleComponent}
      sectionKey={SectionKey.SEER}
      preventCollapse={!hasStreamlinedUI}
    >
      <SeerSectionContainer>
        {aiConfig.orgNeedsGenAiAcknowledgement && !aiConfig.isAutofixSetupLoading ? (
          <Summary>{t('Explore potential root causes and solutions with Seer.')}</Summary>
        ) : aiConfig.hasAutofix || aiConfig.hasSummary ? (
          <SeerSectionContent group={group} project={project} event={event} />
        ) : issueTypeConfig.resources ? (
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
        ) : null}
        {event && showCtaButton && (
          <SeerSectionCtaButton
            aiConfig={aiConfig}
            event={event}
            group={group}
            project={project}
            hasStreamlinedUI={hasStreamlinedUI}
          />
        )}
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
        background: linear-gradient(transparent, ${p.theme.background});
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
    color: ${p => p.theme.gray400};
  }
`;

const HeaderContainer = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;
