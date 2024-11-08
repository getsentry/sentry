import {useRef} from 'react';
import styled from '@emotion/styled';
import Color from 'color';

import {Button} from 'sentry/components/button';
import {AutofixDrawer} from 'sentry/components/events/autofix/autofixDrawer';
import {useGroupSummary} from 'sentry/components/events/autofix/groupSummary';
import useDrawer from 'sentry/components/globalDrawer';
import Placeholder from 'sentry/components/placeholder';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {singleLineRenderer} from 'sentry/utils/marked';
import {SidebarSectionTitle} from 'sentry/views/issueDetails/streamline/sidebar';

const isSummaryEnabled = (hasGenAIConsent: boolean, hasIssueSummary: boolean) => {
  return hasGenAIConsent && hasIssueSummary;
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
  const {openDrawer} = useDrawer();
  const openButtonRef = useRef<HTMLButtonElement>(null);

  const openSolutionsDrawer = () => {
    if (!event) {
      return;
    }
    openDrawer(() => <AutofixDrawer group={group} project={project} event={event} />, {
      ariaLabel: t('Sentry AI drawer'),
      shouldCloseOnInteractOutside: element => {
        const viewAllButton = openButtonRef.current;
        if (
          viewAllButton?.contains(element) ||
          document.getElementById('sentry-feedback')?.contains(element)
        ) {
          return false;
        }
        return true;
      },
      transitionProps: {stiffness: 1000},
    });
  };

  const {data, isPending, hasGenAIConsent} = useGroupSummary(
    group.id,
    group.issueCategory
  );

  const issueTypeConfig = getConfigForIssueType(group, group.project);

  return (
    <div>
      <TitleWrapper>
        <IconSeer size="md" />
        <SidebarSectionTitle
          style={{marginTop: 0, marginLeft: space(1), marginBottom: 0}}
        >
          {t('Sentry AI')}
        </SidebarSectionTitle>
      </TitleWrapper>
      {isPending &&
        isSummaryEnabled(hasGenAIConsent, issueTypeConfig.issueSummary.enabled) && (
          <Placeholder height="60px" width="95%" style={{marginBottom: space(1)}} />
        )}
      {isSummaryEnabled(hasGenAIConsent, issueTypeConfig.issueSummary.enabled) &&
        data && (
          <Summary
            dangerouslySetInnerHTML={{
              __html: singleLineRenderer(data.whatsWrong?.replaceAll('**', '') ?? ''),
            }}
          />
        )}
      {!hasGenAIConsent && !isPending && (
        <Summary>
          Use Sentry AI to explore potential root causes and fixes for this issue.
        </Summary>
      )}
      {hasGenAIConsent && (
        <StyledButton
          ref={openButtonRef}
          onClick={() => openSolutionsDrawer()}
          analyticsEventKey="ai.drawer_opened"
          analyticsEventName="Sentry AI: Drawer Opened"
          analyticsParams={{group_id: group.id}}
        >
          {t('Explore Sentry AI')}
        </StyledButton>
      )}
      {!hasGenAIConsent && (
        <SetupButton
          ref={openButtonRef}
          onClick={() => openSolutionsDrawer()}
          analyticsEventKey="ai.get_started_clicked"
          analyticsEventName="Sentry AI: Get Started Clicked"
          analyticsParams={{group_id: group.id}}
          aria-label={t('Get started with Sentry AI')}
        >
          {!isPending ? (
            t('Get started with Sentry AI')
          ) : (
            <Placeholder height="24px" width="75%" />
          )}
        </SetupButton>
      )}
    </div>
  );
}

const Summary = styled('div')`
  margin-bottom: ${space(1)};
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
`;

const StyledButton = styled(Button)`
  width: 100%;
  background: linear-gradient(
    to right,
    ${p => p.theme.background},
    ${p => Color(p.theme.error).alpha(0.15).string()}
  );
  color: ${p => p.theme.errorText};
`;

const SetupButton = styled(Button)`
  width: 100%;
`;

const TitleWrapper = styled('div')`
  display: flex;
  align-items: center;
  margin-bottom: ${space(1)};
`;
