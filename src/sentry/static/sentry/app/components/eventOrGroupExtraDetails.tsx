import React from 'react';
import {Link, withRouter, WithRouterProps} from 'react-router';
import {css} from '@emotion/core';
import styled from '@emotion/styled';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import EventAnnotation from 'app/components/events/eventAnnotation';
import InboxReason from 'app/components/group/inboxBadges/inboxReason';
import InboxShortId from 'app/components/group/inboxBadges/shortId';
import TimesTag from 'app/components/group/inboxBadges/timesTag';
import UnhandledTag from 'app/components/group/inboxBadges/unhandledTag';
import Times from 'app/components/group/times';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import Placeholder from 'app/components/placeholder';
import ShortId from 'app/components/shortId';
import {IconChat} from 'app/icons';
import {tct} from 'app/locale';
import space from 'app/styles/space';
import {Group, Organization} from 'app/types';
import {Event} from 'app/types/event';
import withOrganization from 'app/utils/withOrganization';

type Props = WithRouterProps<{orgId: string}> & {
  data: Event | Group;
  showAssignee?: boolean;
  organization: Organization;
  hasGuideAnchor?: boolean;
};

function EventOrGroupExtraDetails({
  data,
  showAssignee,
  params,
  organization,
  hasGuideAnchor,
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
  const hasInbox = organization.features.includes('inbox');

  return (
    <GroupExtra hasInbox={hasInbox}>
      {hasInbox && inbox && (
        <GuideAnchor target="inbox_guide_reason" disabled={!hasGuideAnchor}>
          <InboxReason inbox={inbox} />
        </GuideAnchor>
      )}
      {shortId &&
        (hasInbox ? (
          <InboxShortId
            shortId={shortId}
            avatar={
              project && (
                <ShadowlessProjectBadge project={project} avatarSize={12} hideName />
              )
            }
          />
        ) : (
          <GroupShortId
            shortId={shortId}
            avatar={
              project && <ProjectBadge project={project} avatarSize={14} hideName />
            }
            onClick={e => {
              // prevent the clicks from propagating so that the short id can be selected
              e.stopPropagation();
            }}
          />
        ))}
      {isUnhandled && hasInbox && <UnhandledTag />}
      {!lifetime && !firstSeen && !lastSeen ? (
        <Placeholder height="14px" width="100px" />
      ) : hasInbox ? (
        <TimesTag
          lastSeen={lifetime?.lastSeen || lastSeen}
          firstSeen={lifetime?.firstSeen || firstSeen}
        />
      ) : (
        <StyledTimes
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
        <LoggerAnnotation hasInbox={hasInbox}>
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
          hasInbox={hasInbox}
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

const GroupExtra = styled('div')<{hasInbox: boolean}>`
  display: inline-grid;
  grid-auto-flow: column dense;
  grid-gap: ${p => (p.hasInbox ? space(1.5) : space(2))};
  justify-content: start;
  align-items: center;
  color: ${p => (p.hasInbox ? p.theme.textColor : p.theme.subText)};
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

const StyledTimes = styled(Times)`
  margin-right: 0;
`;

const CommentsLink = styled(Link)`
  display: inline-grid;
  grid-gap: ${space(0.5)};
  align-items: center;
  grid-auto-flow: column;
  color: ${p => p.theme.textColor};
`;

const GroupShortId = styled(ShortId)`
  flex-shrink: 0;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;

const AnnotationNoMargin = styled(EventAnnotation)<{hasInbox: boolean}>`
  margin-left: 0;
  padding-left: ${p => (p.hasInbox ? 0 : space(2))};
  ${p => p.hasInbox && `border-left: none;`};

  ${p =>
    p.hasInbox &&
    css`
      & > a {
        color: ${p.theme.textColor};
      }
    `}
`;

const LoggerAnnotation = styled(AnnotationNoMargin)`
  color: ${p => p.theme.textColor};
`;

export default withRouter(withOrganization(EventOrGroupExtraDetails));
