import {useRef, useState} from 'react';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Button} from 'sentry/components/button';
import useDrawer from 'sentry/components/globalDrawer';
import {GroupSummary, useGroupSummary} from 'sentry/components/group/groupSummary';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {singleLineRenderer} from 'sentry/utils/marked';
import useOrganization from 'sentry/utils/useOrganization';
import Resources from 'sentry/views/issueDetails/streamline/resources';
import {SidebarSectionTitle} from 'sentry/views/issueDetails/streamline/sidebar';
import {SolutionsHubDrawer} from 'sentry/views/issueDetails/streamline/solutionsHubDrawer';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

const isSummaryEnabled = (
  hasGenAIConsent: boolean,
  hasIssueSummary: boolean,
  hideAiFeatures: boolean
) => {
  return hasGenAIConsent && hasIssueSummary && !hideAiFeatures;
};

export default function SolutionsSection({
  group,
  project,
  event,
}: {
  event: Event | undefined;
  group: Group;
  project: Project;
}) {
  const organization = useOrganization();
  const [isExpanded, setIsExpanded] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const {openDrawer} = useDrawer();
  const hasStreamlinedUI = useHasStreamlinedUI();

  const openSolutionsDrawer = () => {
    if (!event) {
      return;
    }
    openDrawer(
      () => <SolutionsHubDrawer group={group} project={project} event={event} />,
      {
        ariaLabel: t('Solutions drawer'),
        // We prevent a click on the Open/Close Autofix button from closing the drawer so that
        // we don't reopen it immediately, and instead let the button handle this itself.
        shouldCloseOnInteractOutside: element => {
          const viewAllButton = openButtonRef.current;
          if (
            viewAllButton?.contains(element) ||
            document.getElementById('sentry-feedback')?.contains(element) ||
            document.getElementById('autofix-rethink-input')?.contains(element)
          ) {
            return false;
          }
          return true;
        },
        transitionProps: {stiffness: 1000},
      }
    );
  };

  const hasGenAIConsent = organization.genAIConsent;
  const {
    data: summaryData,
    isPending: isSummaryLoading,
    isError: isSummaryError,
  } = useGroupSummary(group.id, group.issueCategory);

  const issueTypeConfig = getConfigForIssueType(group, group.project);
  const hasSummary = isSummaryEnabled(
    hasGenAIConsent,
    issueTypeConfig.issueSummary.enabled,
    organization.hideAiFeatures
  );
  const aiNeedsSetup =
    !hasGenAIConsent &&
    issueTypeConfig.issueSummary.enabled &&
    !organization.hideAiFeatures;
  const hasResources = issueTypeConfig.resources;

  return (
    <div>
      <SidebarSectionTitle style={{marginTop: 0}}>
        <HeaderContainer>
          {t('Solutions Hub')}
          {hasSummary && (
            <StyledFeatureBadge
              type="beta"
              title={tct(
                'This feature is in beta. Try it out and let us know your feedback at [email:autofix@sentry.io].',
                {
                  email: <a href="mailto:autofix@sentry.io" />,
                }
              )}
            />
          )}
        </HeaderContainer>
      </SidebarSectionTitle>
      {hasSummary && (
        <Summary>
          <GroupSummary
            data={summaryData ?? undefined}
            isError={isSummaryError}
            isPending={isSummaryLoading}
            preview
          />
        </Summary>
      )}
      {aiNeedsSetup && (
        <Summary>
          <HeadlineText
            dangerouslySetInnerHTML={{
              __html: singleLineRenderer(
                'Explore potential root causes and solutions with Sentry AI.'
              ),
            }}
          />
        </Summary>
      )}
      {!hasSummary && hasResources && !aiNeedsSetup && (
        <ResourcesWrapper isExpanded={isExpanded}>
          <ResourcesContent isExpanded={isExpanded}>
            <Resources
              configResources={issueTypeConfig.resources!}
              eventPlatform={event?.platform}
              group={group}
            />
          </ResourcesContent>
          <ExpandButton onClick={() => setIsExpanded(!isExpanded)} size="zero">
            {isExpanded ? t('SHOW LESS') : t('READ MORE')}
          </ExpandButton>
        </ResourcesWrapper>
      )}
      {(hasSummary || aiNeedsSetup) && (
        <StyledButton
          ref={openButtonRef}
          onClick={() => openSolutionsDrawer()}
          analyticsEventKey="issue_details.solutions_hub_opened"
          analyticsEventName="Issue Details: Solutions Hub Opened"
          analyticsParams={{
            has_streamlined_ui: hasStreamlinedUI,
          }}
        >
          {t('Open Solutions Hub')}
          <IconChevron direction="right" size="xs" />
        </StyledButton>
      )}
    </div>
  );
}

const Summary = styled('div')`
  margin-bottom: ${space(0.5)};
  position: relative;
`;

const HeadlineText = styled('span')`
  margin-right: ${space(0.5)};
  word-break: break-word;
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

const StyledButton = styled(Button)`
  margin-top: ${space(1)};
  width: 100%;
  background: ${p => p.theme.background}
    linear-gradient(to right, ${p => p.theme.background}, ${p => p.theme.pink400}20);
  color: ${p => p.theme.pink400};
`;

const HeaderContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const StyledFeatureBadge = styled(FeatureBadge)`
  margin-left: ${space(0.25)};
  padding-bottom: 3px;
`;
