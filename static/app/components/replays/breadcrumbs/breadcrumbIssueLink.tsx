import styled from '@emotion/styled';

import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {Link} from 'sentry/components/core/link';
import {useReplayGroupContext} from 'sentry/components/replays/replayGroupContext';
import {space} from 'sentry/styles/space';
import type {ErrorFrame, FeedbackFrame, ReplayFrame} from 'sentry/utils/replays/types';
import {isErrorFrame, isFeedbackFrame} from 'sentry/utils/replays/types';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';
import {makeFeedbackPathname} from 'sentry/views/userFeedback/pathnames';

interface Props {
  frame: ReplayFrame;
}

export function BreadcrumbIssueLink({frame}: Props) {
  if (!isErrorFrame(frame) && !isFeedbackFrame(frame)) {
    return null;
  }

  return <CrumbErrorIssue frame={frame} />;
}

function CrumbErrorIssue({frame}: {frame: FeedbackFrame | ErrorFrame}) {
  const organization = useOrganization();
  const project = useProjectFromSlug({organization, projectSlug: frame.data.projectSlug});
  const {groupId} = useReplayGroupContext();

  const projectAvatar = project ? <ProjectAvatar project={project} size={16} /> : null;

  if (String(frame.data.groupId) === groupId) {
    return (
      <CrumbIssueWrapper>
        {projectAvatar}
        {frame.data.groupShortId}
      </CrumbIssueWrapper>
    );
  }

  return (
    <CrumbIssueWrapper>
      {projectAvatar}
      <Link
        to={
          isFeedbackFrame(frame)
            ? {
                pathname: makeFeedbackPathname({
                  path: '/',
                  organization,
                }),
                query: {feedbackSlug: `${frame.data.projectSlug}:${frame.data.groupId}`},
              }
            : `/organizations/${organization.slug}/issues/${frame.data.groupId}/`
        }
      >
        {frame.data.groupShortId}
      </Link>
    </CrumbIssueWrapper>
  );
}

const CrumbIssueWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;
