import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {Link} from 'react-router';
import styled from 'react-emotion';
import {Flex, Box} from 'grid-emotion';

import ProjectState from 'app/mixins/projectState';
import TimeSince from 'app/components/timeSince';
import ShortId from 'app/components/shortId';
import {t, tct} from 'app/locale';

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
      <GroupExtra align="center">
        {shortId && (
          <Box mr={2}>
            <GroupShortId shortId={shortId} />
          </Box>
        )}
        <Flex align="center" mr={2}>
          {lastSeen && (
            <React.Fragment>
              <GroupExtraIcon className="icon icon-clock" />
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
        </Flex>
        <GroupExtraCommentsAndLogger>
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
        </GroupExtraCommentsAndLogger>
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
    );
  },
});

const GroupExtra = styled(Flex)`
  color: ${p => p.theme.gray3};
  font-size: 12px;
  a {
    color: inherit;
  }
`;

const GroupExtraCommentsAndLogger = styled(Flex)`
  color: ${p => p.theme.gray4};
`;

const GroupShortId = styled(ShortId)`
  font-size: 12px;
  color: ${p => p.theme.gray3};
`;

const GroupExtraIcon = styled.span`
  font-size: 11px;
  margin-right: 4px;
`;

export default EventOrGroupExtraDetails;
