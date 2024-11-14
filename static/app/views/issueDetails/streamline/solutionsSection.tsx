import {useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import useDrawer from 'sentry/components/globalDrawer';
import {useGroupSummary} from 'sentry/components/group/groupSummary';
import Placeholder from 'sentry/components/placeholder';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
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
  const {data: summaryData} = useGroupSummary(group.id, group.issueCategory);

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
        {t('Solutions Hub')}
      </SidebarSectionTitle>
      {hasSummary && !summaryData && (
        <Placeholder
          height="60px"
          style={{marginBottom: space(1)}}
          testId="loading-placeholder"
        />
      )}
      {hasSummary && summaryData && (
        <Summary>
          <HeadlineText
            dangerouslySetInnerHTML={{
              __html: singleLineRenderer(
                summaryData.whatsWrong?.replaceAll('**', '') ?? ''
              ),
            }}
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
        <StyledButton ref={openButtonRef} onClick={() => openSolutionsDrawer()}>
          {t('Open Solutions Hub')}
          <IconChevron direction="right" size="xs" />
        </StyledButton>
      )}
    </div>
  );
}

const Summary = styled('div')`
  margin-bottom: ${space(0.5)};
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
