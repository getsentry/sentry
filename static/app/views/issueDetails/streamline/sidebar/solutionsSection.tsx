import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {GroupSummary} from 'sentry/components/group/groupSummary';
import {GroupSummaryWithAutofix} from 'sentry/components/group/groupSummaryWithAutofix';
import {IconMegaphone} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';
import Resources from 'sentry/views/issueDetails/streamline/sidebar/resources';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

import {SolutionsSectionCtaButton} from './solutionsSectionCtaButton';

function SolutionsHubFeedbackButton({hidden}: {hidden: boolean}) {
  const openFeedbackForm = useFeedbackForm();
  if (hidden) {
    return null;
  }
  return (
    <Button
      aria-label={t('Give feedback on the solutions hub')}
      icon={<IconMegaphone />}
      size="xs"
      onClick={() =>
        openFeedbackForm?.({
          messagePlaceholder: t('How can we make Issue Summary better for you?'),
          tags: {
            ['feedback.source']: 'issue_details_ai_autofix',
            ['feedback.owner']: 'ml-ai',
          },
        })
      }
    />
  );
}

function SolutionsSectionContent({
  group,
  project,
  event,
}: {
  event: Event | undefined;
  group: Group;
  project: Project;
}) {
  const aiConfig = useAiConfig(group, event, project);

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

export default function SolutionsSection({
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

  const aiConfig = useAiConfig(group, event, project);
  const issueTypeConfig = getConfigForIssueType(group, project);
  const showCtaButton =
    aiConfig.needsGenAIConsent ||
    aiConfig.hasAutofix ||
    (aiConfig.hasSummary && aiConfig.hasResources);

  const titleComponent = (
    <HeaderContainer>
      {t('Solutions Hub')}
      {aiConfig.hasSummary && (
        <FeatureBadge
          type="beta"
          tooltipProps={{
            title: tct(
              'This feature is in beta. Try it out and let us know your feedback at [email:autofix@sentry.io].',
              {
                email: <a href="mailto:autofix@sentry.io" />,
              }
            ),
          }}
        />
      )}
    </HeaderContainer>
  );

  return (
    <SidebarFoldSection
      title={titleComponent}
      sectionKey={SectionKey.SOLUTIONS_HUB}
      actions={<SolutionsHubFeedbackButton hidden={!aiConfig.hasSummary} />}
      preventCollapse={!hasStreamlinedUI}
    >
      <SolutionsSectionContainer>
        {aiConfig.needsGenAIConsent ? (
          <Summary>{t('Explore potential root causes and solutions with Seer.')}</Summary>
        ) : aiConfig.hasAutofix || aiConfig.hasSummary ? (
          <SolutionsSectionContent group={group} project={project} event={event} />
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
          <SolutionsSectionCtaButton
            aiConfig={aiConfig}
            event={event}
            group={group}
            project={project}
            hasStreamlinedUI={hasStreamlinedUI}
          />
        )}
      </SolutionsSectionContainer>
    </SidebarFoldSection>
  );
}

const SolutionsSectionContainer = styled('div')`
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
    `
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
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.gray300};
  border: none;
  box-shadow: none;

  &:hover {
    color: ${p => p.theme.gray400};
  }
`;

const HeaderContainer = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  display: flex;
  align-items: center;
  gap: ${space(0.25)};
`;
