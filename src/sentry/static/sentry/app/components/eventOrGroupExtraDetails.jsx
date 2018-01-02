import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {Link} from 'react-router';

import ProjectState from '../mixins/projectState';
import TimeSince from './timeSince';
import ShortId from './shortId';

const EventOrGroupExtraDetails = createReactClass({
  displayName: 'EventOrGroupExtraDetails',

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
      firstSeen,
      shortId,
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
      <div className="event-extra">
        <ul>
          {shortId && (
            <li>
              <ShortId shortId={shortId} />
            </li>
          )}
          <li>
            <span className="icon icon-clock" />
            {lastSeen && <TimeSince date={lastSeen} />}
            {firstSeen && lastSeen && <span>&nbsp;—&nbsp;</span>}
            {firstSeen && <TimeSince date={firstSeen} suffix="old" />}
          </li>
          {numComments > 0 && (
            <li>
              <Link
                to={`/${orgId}/${projectId}/issues/${groupId}/activity/`}
                className="comments"
              >
                <span className="icon icon-comments" style={styles} />
                <span className="tag-count">{numComments}</span>
              </Link>
            </li>
          )}
          {logger && (
            <li className="event-annotation">
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
            </li>
          )}
          {annotations &&
            annotations.map((annotation, key) => {
              return (
                <li
                  className="event-annotation"
                  dangerouslySetInnerHTML={{
                    __html: annotation,
                  }}
                  key={key}
                />
              );
            })}

          {showAssignee && assignedTo && <li>Assigned to {assignedTo.name}</li>}
        </ul>
      </div>
    );
  },
});
export default EventOrGroupExtraDetails;
