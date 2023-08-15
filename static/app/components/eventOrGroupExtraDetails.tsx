import styled from '@emotion/styled';

import EventAnnotation from 'sentry/components/events/eventAnnotation';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import InboxReason from 'sentry/components/group/inboxBadges/inboxReason';
import InboxShortId from 'sentry/components/group/inboxBadges/shortId';
import {GroupStatusBadge} from 'sentry/components/group/inboxBadges/statusBadge';
import TimesTag from 'sentry/components/group/inboxBadges/timesTag';
import UnhandledTag from 'sentry/components/group/inboxBadges/unhandledTag';
import IssueReplayCount from 'sentry/components/group/issueReplayCount';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import {IconChat} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group, Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {projectCanLinkToReplay} from 'sentry/utils/replays/projectSupportsReplay';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  data: Event | Group;
  organization: Organization;
  showAssignee?: boolean;
  showInboxTime?: boolean;
};

function EventOrGroupExtraDetails({
  data,
  showAssignee,
  showInboxTime,
  organization,
}: Props) {
  const {
    id,
    lastSeen,
    firstSeen,
    subscriptionDetails,
    numComments,
    logger,
    assignedTo,
    annotations,
    shortId,
    project,
    lifetime,
    isUnhandled,
    inbox,
    status,
    substatus,
  } = data as Group;

  const issuesPath = `/organizations/${organization.slug}/issues/`;

  const showReplayCount =
    organization.features.includes('session-replay') && projectCanLinkToReplay(project);
  const hasEscalatingIssuesUi = organization.features.includes('escalating-issues');

  return (
    <GroupExtra>
      {!hasEscalatingIssuesUi && inbox && (
        <InboxReason inbox={inbox} showDateAdded={showInboxTime} />
      )}
      {hasEscalatingIssuesUi && (
        <GroupStatusBadge status={status} substatus={substatus} />
      )}
      {shortId && (
        <InboxShortId
          shortId={shortId}
          avatar={
            project && (
              <ShadowlessProjectBadge project={project} avatarSize={12} hideName />
            )
          }
        />
      )}
      {isUnhandled && <UnhandledTag />}
      {!lifetime && !firstSeen && !lastSeen ? (
        <Placeholder height="14px" width="100px" />
      ) : (
        <TimesTag
          lastSeen={lifetime?.lastSeen || lastSeen}
          firstSeen={lifetime?.firstSeen || firstSeen}
        />
      )}
      {/* Always display comment count on inbox */}
      {numComments > 0 && (
        <CommentsLink to={`${issuesPath}${id}/activity/`} className="comments">
          <IconChat
            size="xs"
            color={
              subscriptionDetails?.reason === 'mentioned' ? 'successText' : undefined
            }
          />
          <span>{numComments}</span>
        </CommentsLink>
      )}
      {showReplayCount && <IssueReplayCount groupId={id} />}
      {logger && (
        <LoggerAnnotation>
          <GlobalSelectionLink
            to={{
              pathname: issuesPath,
              query: {
                query: `logger:${logger}`,
              },
            }}
          >
            {logger}
          </GlobalSelectionLink>
        </LoggerAnnotation>
      )}
      {annotations?.map((annotation, key) => (
        <AnnotationNoMargin
          dangerouslySetInnerHTML={{
            __html: annotation,
          }}
          key={key}
        />
      ))}

      {showAssignee && assignedTo && (
        <div>{tct('Assigned to [name]', {name: assignedTo.name})}</div>
      )}
    </GroupExtra>
  );
}

const GroupExtra = styled('div')`
  display: inline-grid;
  grid-auto-flow: column dense;
  gap: ${space(1.5)};
  justify-content: start;
  align-items: center;
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  position: relative;
  min-width: 500px;
  white-space: nowrap;
  line-height: 1.2;

  a {
    color: inherit;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    line-height: 1;
  }
`;

const ShadowlessProjectBadge = styled(ProjectBadge)`
  * > img {
    box-shadow: none;
  }
`;

const CommentsLink = styled(Link)`
  display: inline-grid;
  gap: ${space(0.5)};
  align-items: center;
  grid-auto-flow: column;
  color: ${p => p.theme.textColor};
`;

const AnnotationNoMargin = styled(EventAnnotation)`
  margin-left: 0;
  padding-left: 0;
  border-left: none;
  & > a {
    color: ${p => p.theme.textColor};
  }
`;

const LoggerAnnotation = styled(AnnotationNoMargin)`
  color: ${p => p.theme.textColor};
`;

export default withOrganization(EventOrGroupExtraDetails);
