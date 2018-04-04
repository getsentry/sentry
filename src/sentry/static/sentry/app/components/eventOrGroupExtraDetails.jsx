import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {Link} from 'react-router';
import styled from 'react-emotion';
import {Flex, Box} from 'grid-emotion';

import ProjectState from '../mixins/projectState';
import TimeSince from './timeSince';
import ShortId from './shortId';
import {t, tct} from '../locale';

const EventOrGroupExtraDetails = createReactClass({
  displayName: 'EventOrGroupExtraDetails',

  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    groupId: PropTypes.string.isRequired,
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
  },

  mixins: [ProjectState],

  render() {
    let {
      orgId,
      projectId,
      groupId,
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
    let styles = {};
    if (subscriptionDetails && subscriptionDetails.reason === 'mentioned') {
      styles = {color: '#57be8c'};
    }

    return (
      <Flex align="center">
        <Box mr={2}>{shortId && <GroupShortId shortId={shortId} />}</Box>
        <GroupExtra>
          <Flex align="center" mr={2}>
            {lastSeen && (
              <React.Fragment>
                <GroupExtraIcon className="icon icon-clock" />
                <TimeSince date={lastSeen} suffix={t('ago')} />
              </React.Fragment>
            )}
            {firstSeen && lastSeen && <span>&nbsp;—&nbsp;</span>}
            {firstSeen && <TimeSince date={firstSeen} suffix={t('old')} />}
          </Flex>
          {numComments > 0 && (
            <Box mr={2}>
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
            <Box className="event-annotation" mr={2}>
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

          {showAssignee &&
            assignedTo && <Box>{tct('Assigned to [name]', {name: assignedTo.name})}</Box>}
        </GroupExtra>
      </Flex>
    );
  },
});

const GroupExtra = styled(Flex)`
  color: ${p => p.theme.gray2}
  font-size: 12px;
`;

const GroupShortId = styled(ShortId)`
  font-weight: 600;
`;

const GroupExtraIcon = styled.span`
  color: ${p => p.theme.gray2};
  font-size: 11px;
  margin-right: 4px;
`;

export default EventOrGroupExtraDetails;
