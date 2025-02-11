import {Fragment} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {IconMegaphone} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useLocation} from 'sentry/utils/useLocation';
import {Divider} from 'sentry/views/issueDetails/divider';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export function UserFeedbackBadge({group, project}: {group: Group; project: Project}) {
  const {baseUrl} = useGroupDetailsRoute();
  const location = useLocation();

  const issueTypeConfig = getConfigForIssueType(group, project);

  if (!issueTypeConfig.pages.userFeedback.enabled || group.userReportCount <= 0) {
    return null;
  }

  return (
    <Fragment>
      <Divider />
      <UserFeedbackButton
        type="button"
        priority="link"
        size="zero"
        icon={<IconMegaphone size="xs" />}
        to={{
          pathname: `${baseUrl}${TabPaths[Tab.USER_FEEDBACK]}`,
          query: location.query,
        }}
        aria-label={t("View this issues's feedback")}
      >
        {tn('%s User Report', '%s User Reports', group.userReportCount)}
      </UserFeedbackButton>
    </Fragment>
  );
}

const UserFeedbackButton = styled(LinkButton)`
  color: ${p => p.theme.gray300};
  text-decoration: underline;
  text-decoration-style: dotted;
`;
