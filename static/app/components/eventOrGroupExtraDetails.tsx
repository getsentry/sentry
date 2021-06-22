import {Link, withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import EventAnnotation from 'app/components/events/eventAnnotation';
import InboxReason from 'app/components/group/inboxBadges/inboxReason';
import InboxShortId from 'app/components/group/inboxBadges/shortId';
import TimesTag from 'app/components/group/inboxBadges/timesTag';
import UnhandledTag from 'app/components/group/inboxBadges/unhandledTag';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import Placeholder from 'app/components/placeholder';
import {IconChat} from 'app/icons';
import {tct} from 'app/locale';
import space from 'app/styles/space';
import {Group} from 'app/types';
import {Event} from 'app/types/event';

type Props = WithRouterProps<{orgId: string}> & {
  data: Event | Group;
  showAssignee?: boolean;
  hasGuideAnchor?: boolean;
  showInboxTime?: boolean;
};

function EventOrGroupExtraDetails({
  data,
  showAssignee,
  params,
  hasGuideAnchor,
  showInboxTime,
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
  } = data as Group;

  const issuesPath = `/organizations/${params.orgId}/issues/`;
  const inboxReason = inbox && (
    <InboxReason inbox={inbox} showDateAdded={showInboxTime} />
  );

  return (
    <GroupExtra>
      {inbox && (
        <GuideAnchor target="inbox_guide_reason" disabled={!hasGuideAnchor}>
          {inboxReason}
        </GuideAnchor>
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
            color={subscriptionDetails?.reason === 'mentioned' ? 'green300' : undefined}
          />
          <span>{numComments}</span>
        </CommentsLink>
      )}
      {logger && (
        <LoggerAnnotation>
          <Link
            to={{
              pathname: issuesPath,
              query: {
                query: `logger:${logger}`,
              },
            }}
          >
            {logger}
          </Link>
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
  grid-gap: ${space(1.5)};
  justify-content: start;
  align-items: center;
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  position: relative;
  min-width: 500px;
  white-space: nowrap;

  a {
    color: inherit;
  }
`;

const ShadowlessProjectBadge = styled(ProjectBadge)`
  * > img {
    box-shadow: none;
  }
`;

const CommentsLink = styled(Link)`
  display: inline-grid;
  grid-gap: ${space(0.5)};
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

export default withRouter(EventOrGroupExtraDetails);
