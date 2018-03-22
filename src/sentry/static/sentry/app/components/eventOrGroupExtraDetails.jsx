import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {Link} from 'react-router';
import styled from 'react-emotion';
import {Flex, Box} from 'grid-emotion';

import ProjectState from '../mixins/projectState';
import TimeSince from './timeSince';

const EventOrIssueExtraDetails = createReactClass({
  displayName: 'EventOrIssueExtraDetails',

  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    groupId: PropTypes.string.isRequired,
    firstSeen: PropTypes.string,
    lastSeen: PropTypes.string,
    shortId: PropTypes.string,
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
  },

  mixins: [ProjectState],

  render() {
    let {
      orgId,
      projectId,
      groupId,
      lastSeen,
      subscriptionDetails,
      numComments,
      logger,
      assignedTo,
      annotations,
      showAssignee,
    } = this.props;
    let styles = {};
    if (subscriptionDetails && subscriptionDetails.reason === 'mentioned') {
      styles = {color: '#57be8c'};
    }

    return (
      <GroupExtra>
        {lastSeen && (
          <Box>
            <GroupExtraIcon className="icon icon-clock" />
            <TimeSince date={lastSeen} suffix="ago" />
          </Box>
        )}
        {numComments > 0 && (
          <Box>
            <Link
              to={`/${orgId}/${projectId}/issues/${groupId}/activity/`}
              className="comments"
            >
              <GroupExtraIcon className="icon icon-comments" style={styles} />
              <GroupExtraIcon className="tag-count">{numComments}</GroupExtraIcon>
            </Link>
          </Box>
        )}
        {logger && (
          <Box className="event-annotation">
            <Link
              to={{
                pathname: `/${orgId}/${projectId}/`,
                query: {
                  query: 'logger:' + logger,
                },
              }}
            >
              {logger}
            </Link>
          </Box>
        )}
        {annotations &&
          annotations.map((annotation, key) => {
            return (
              <Box
                className="event-annotation"
                dangerouslySetInnerHTML={{
                  __html: annotation,
                }}
                key={key}
              />
            );
          })}

        {showAssignee && assignedTo && <Box>Assigned to {assignedTo.name}</Box>}
      </GroupExtra>
    );
  },
});

const GroupExtra = styled(Flex)`
  color: ${p => p.theme.gray2};
  font-size: 12px;
`;

const GroupExtraIcon = styled.span`
  color: ${p => p.theme.gray2};
  font-size: 11px;
  margin-right: 4px;
  opacity: 0.5;
`;

export default EventOrIssueExtraDetails;
