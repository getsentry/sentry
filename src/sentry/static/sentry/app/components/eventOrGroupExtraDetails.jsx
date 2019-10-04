import {Link, withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {tct} from 'app/locale';
import EventAnnotation from 'app/components/events/eventAnnotation';
import InlineSvg from 'app/components/inlineSvg';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import SentryTypes from 'app/sentryTypes';
import ShortId from 'app/components/shortId';
import Times from 'app/components/group/times';
import space from 'app/styles/space';

class EventOrGroupExtraDetails extends React.Component {
  static propTypes = {
    id: PropTypes.string,
    lastSeen: PropTypes.string,
    firstSeen: PropTypes.string,
    subscriptionDetails: PropTypes.shape({
      reason: PropTypes.string,
    }),
    numComments: PropTypes.number,
    logger: PropTypes.string,
    annotations: PropTypes.arrayOf(PropTypes.string),
    assignedTo: PropTypes.shape({
      name: PropTypes.string,
    }),
    showAssignee: PropTypes.bool,
    shortId: PropTypes.string,
    project: SentryTypes.Project,
  };

  render() {
    const {
      id,
      lastSeen,
      firstSeen,
      subscriptionDetails,
      numComments,
      logger,
      assignedTo,
      annotations,
      showAssignee,
      shortId,
      project,
      params,
    } = this.props;

    const issuesPath = `/organizations/${params.orgId}/issues/`;

    return (
      <GroupExtra>
        {shortId && (
          <GroupShortId
            shortId={shortId}
            avatar={
              project && <ProjectBadge project={project} avatarSize={14} hideName />
            }
          />
        )}
        <StyledTimes lastSeen={lastSeen} firstSeen={firstSeen} />
        {numComments > 0 && (
          <CommentsLink to={`${issuesPath}${id}/activity/`} className="comments">
            <GroupExtraIcon
              src="icon-comment-sm"
              mentioned={
                subscriptionDetails && subscriptionDetails.reason === 'mentioned'
              }
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
                  query: 'logger:' + logger,
                },
              }}
            >
              {logger}
            </Link>
          </LoggerAnnotation>
        )}
        {annotations &&
          annotations.map((annotation, key) => {
            return (
              <AnnotationNoMargin
                dangerouslySetInnerHTML={{
                  __html: annotation,
                }}
                key={key}
              />
            );
          })}

        {showAssignee && assignedTo && (
          <div>{tct('Assigned to [name]', {name: assignedTo.name})}</div>
        )}
      </GroupExtra>
    );
  }
}

const GroupExtra = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-gap: ${space(2)};
  justify-content: start;
  align-items: center;
  color: ${p => p.theme.gray3};
  font-size: 12px;
  position: relative;

  a {
    color: inherit;
  }
`;

const StyledTimes = styled(Times)`
  margin-right: 0;
`;

const CommentsLink = styled(Link)`
  color: ${p => p.theme.gray4};
`;

const GroupShortId = styled(ShortId)`
  flex-shrink: 0;
  font-size: 12px;
  color: ${p => p.theme.gray3};
`;

const GroupExtraIcon = styled(InlineSvg)`
  color: ${p => (p.isMentioned ? p.theme.green : null)};
  font-size: 11px;
  margin-right: 4px;
`;

const AnnotationNoMargin = styled(EventAnnotation)`
  margin-left: 0;
  padding-left: ${space(2)};
`;

const LoggerAnnotation = styled(AnnotationNoMargin)`
  color: ${p => p.theme.gray4};
`;

export default withRouter(EventOrGroupExtraDetails);
