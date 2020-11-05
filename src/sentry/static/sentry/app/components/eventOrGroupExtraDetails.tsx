import React from 'react';
import {Link, withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {Event, Group} from 'app/types';
import {IconChat} from 'app/icons';
import {tct} from 'app/locale';
import EventAnnotation from 'app/components/events/eventAnnotation';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import ShortId from 'app/components/shortId';
import Times from 'app/components/group/times';
import space from 'app/styles/space';

type Props = WithRouterProps<{orgId: string}> & {
  data: Event | Group;
  showAssignee?: boolean;
};

function EventOrGroupExtraDetails({data, showAssignee, params}: Props) {
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
  } = data as Group;

  const issuesPath = `/organizations/${params.orgId}/issues/`;

  return (
    <GroupExtra>
      {shortId && (
        <GroupShortId
          shortId={shortId}
          avatar={project && <ProjectBadge project={project} avatarSize={14} hideName />}
          onClick={e => {
            // prevent the clicks from propagating so that the short id can be selected
            e.stopPropagation();
          }}
        />
      )}
      <StyledTimes
        lastSeen={lifetime?.lastSeen || lastSeen}
        firstSeen={lifetime?.firstSeen || firstSeen}
      />
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
      {annotations &&
        annotations.map((annotation, key) => (
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
  grid-gap: ${space(2)};
  justify-content: start;
  align-items: center;
  color: ${p => p.theme.gray600};
  font-size: ${p => p.theme.fontSizeSmall};
  position: relative;
  min-width: 500px;
  white-space: nowrap;

  a {
    color: inherit;
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
  color: ${p => p.theme.gray700};
`;

const GroupShortId = styled(ShortId)`
  flex-shrink: 0;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray600};
`;

const AnnotationNoMargin = styled(EventAnnotation)`
  margin-left: 0;
  padding-left: ${space(2)};
`;

const LoggerAnnotation = styled(AnnotationNoMargin)`
  color: ${p => p.theme.gray700};
`;

export default withRouter(EventOrGroupExtraDetails);
