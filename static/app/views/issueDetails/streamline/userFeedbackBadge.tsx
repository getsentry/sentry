import {Fragment, useRef} from 'react';

import {UserFeedbackDrawer} from 'sentry/components/events/userFeedback/userFeedbackDrawer';
import useDrawer, {type DrawerOptions} from 'sentry/components/globalDrawer';
import {IconMegaphone} from 'sentry/icons';
import {tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {Divider} from 'sentry/views/issueDetails/divider';
import {TextButton} from 'sentry/views/issueDetails/streamline/attachmentsBadge';

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
      <TextButton
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
      </TextButton>
    </Fragment>
  );
}
