import {useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import useDrawer from 'sentry/components/globalDrawer';
import {useGroupSummary} from 'sentry/components/group/groupSummary';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {IssueCategory} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {SidebarSectionTitle} from 'sentry/views/issueDetails/streamline/sidebar';
import {SolutionsDrawer} from 'sentry/views/issueDetails/streamline/solutionsDrawer';

const isSummaryEnabled = (hasGenAIConsent: boolean, groupCategory: IssueCategory) => {
  return hasGenAIConsent && groupCategory === IssueCategory.ERROR;
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
    openDrawer(() => <SolutionsDrawer group={group} project={project} event={event} />, {
      ariaLabel: t('Solutions drawer'),
      // We prevent a click on the Open/Close Autofix button from closing the drawer so that
      // we don't reopen it immediately, and instead let the button handle this itself.
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

  return (
    <div>
      <SidebarSectionTitle style={{marginTop: 0}}>
        {t('Solutions & Resources')}
      </SidebarSectionTitle>
      {isPending && isSummaryEnabled(hasGenAIConsent, group.issueCategory) && (
        <Placeholder height="19px" width="95%" style={{marginBottom: space(1)}} />
      )}
      {isSummaryEnabled(hasGenAIConsent, group.issueCategory) && data && (
        <Summary>{data.headline}</Summary>
      )}
      <StyledButton ref={openButtonRef} onClick={() => openSolutionsDrawer()}>
        {t('See More')}
      </StyledButton>
    </div>
  );
}

const Summary = styled('div')`
  margin-bottom: ${space(1)};
`;

const StyledButton = styled(Button)`
  width: 100%;
`;
