import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {UserFeedbackDrawer} from 'sentry/components/events/userFeedback/userFeedbackDrawer';
import useDrawer, {type DrawerOptions} from 'sentry/components/globalDrawer';
import {IconMegaphone} from 'sentry/icons';
import {tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {Divider} from 'sentry/views/issueDetails/divider';

export function UserFeedbackBadge({group, project}: {group: Group; project: Project}) {
  const {openDrawer} = useDrawer();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const drawerOptions: DrawerOptions = {
    ariaLabel: 'user feedback drawer',
    shouldCloseOnInteractOutside: el => {
      if (openButtonRef.current?.contains(el)) {
        return false;
      }
      return true;
    },
  };
  const issueTypeConfig = getConfigForIssueType(group, project);

  if (!issueTypeConfig.userFeedback.enabled || group.userReportCount <= 0) {
    return null;
  }

  return (
    <Fragment>
      <Divider />
      <UserFeedbackButton
        ref={openButtonRef}
        type="button"
        priority="link"
        size="zero"
        icon={<IconMegaphone size="xs" />}
        onClick={() => {
          openDrawer(
            () => <UserFeedbackDrawer group={group} project={project} />,
            drawerOptions
          );
        }}
      >
        {tn('%s User Report', '%s User Reports', group.userReportCount)}
      </UserFeedbackButton>
    </Fragment>
  );
}

export const UserFeedbackButton = styled(Button)`
  color: ${p => p.theme.gray300};
  text-decoration: underline;
  text-decoration-style: dotted;
`;
