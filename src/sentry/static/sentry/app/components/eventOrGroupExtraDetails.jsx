import PropTypes from 'prop-types';
import React from 'react';
import {Link, withRouter} from 'react-router';
import styled from 'react-emotion';
import {Flex, Box} from 'grid-emotion';

import TimeSince from 'app/components/timeSince';
import ShortId from 'app/components/shortId';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {t, tct} from 'app/locale';
import InlineSvg from 'app/components/inlineSvg';
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
  };

  getIssuesPath() {
    const {orgId, projectId} = this.props.params;

    return projectId
      ? `/${orgId}/${projectId}/issues/`
      : `/organizations/${orgId}/issues/`;
  }

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
    } = this.props;

    const issuesPath = this.getIssuesPath();

    return (
      <GroupExtra align="center">
        {shortId && <GroupShortId shortId={shortId} />}
        <Times>
          <div css={overflowEllipsis}>
            {lastSeen && (
              <React.Fragment>
                <GroupTimeIcon src="icon-clock-sm" />
                <TimeSince date={lastSeen} suffix={t('ago')} />
              </React.Fragment>
            )}
            {firstSeen &&
              lastSeen && <span className="hidden-xs hidden-sm">&nbsp;—&nbsp;</span>}
            {firstSeen && (
              <TimeSince
                date={firstSeen}
                suffix={t('old')}
                className="hidden-xs hidden-sm"
              />
            )}
          </div>
        </Times>
        <GroupExtraCommentsAndLogger>
          {numComments > 0 && (
            <Box mr={2}>
              <CommentsLink to={`${issuesPath}${id}/activity/`} className="comments">
                <GroupExtraIcon
                  src="icon-comment-sm"
                  mentioned={
                    subscriptionDetails && subscriptionDetails.reason === 'mentioned'
                  }
                />
                <span>{numComments}</span>
              </CommentsLink>
            </Box>
          )}
          {logger && (
            <Box className="event-annotation" mr={2}>
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
            </Box>
          )}
        </GroupExtraCommentsAndLogger>
        {annotations &&
          annotations.map((annotation, key) => {
            return (
              <div
                className="event-annotation"
                dangerouslySetInnerHTML={{
                  __html: annotation,
                }}
                key={key}
              />
            );
          })}

        {showAssignee &&
          assignedTo && <div>{tct('Assigned to [name]', {name: assignedTo.name})}</div>}
      </GroupExtra>
    );
  }
}

const GroupExtra = styled(Flex)`
  color: ${p => p.theme.gray3};
  font-size: 12px;
  position: relative;

  a {
    color: inherit;
  }
`;

const GroupExtraCommentsAndLogger = styled(Flex)`
  color: ${p => p.theme.gray4};
`;

const CommentsLink = styled(Link)`
  display: flex;
  align-items: center;
  flex-shrink: 0;
`;

const Times = styled('div')`
  margin-right: ${space(2)};
  flex-shrink: 1;
  min-width: 0; /* flex-hack for overflow-ellipsised children */
`;

const GroupShortId = styled(ShortId)`
  margin-right: ${space(2)};
  flex-shrink: 0;
  font-size: 12px;
  color: ${p => p.theme.gray3};
`;

const GroupExtraIcon = styled(InlineSvg)`
  color: ${p => (p.isMentioned ? p.theme.green : null)};
  font-size: 11px;
  margin-right: 4px;
`;

const GroupTimeIcon = styled(GroupExtraIcon)`
  /* this is solely for optics, since TimeSince always begins
  with a number, and numbers do not have descenders */
  transform: translateY(-1px);
`;

export default withRouter(EventOrGroupExtraDetails);
