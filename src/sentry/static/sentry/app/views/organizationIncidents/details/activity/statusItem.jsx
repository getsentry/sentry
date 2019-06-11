import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {
  INCIDENT_ACTIVITY_TYPE,
  INCIDENT_STATUS,
} from 'app/views/organizationIncidents/utils';
import {t} from 'app/locale';
import ActivityItem from 'app/components/activity/item';
import Chart from 'app/views/organizationIncidents/details/chart';
import SentryTypes from 'app/sentryTypes';

/**
 * StatusItem renders status changes for Incidents
 *
 * For example: incident created, detected, or closed
 *
 * Note `activity.dateCreated` refers to when the activity was created vs.
 * `incident.dateStarted` which is when an incident was first detected or created
 */
class StatusItem extends React.Component {
  static propTypes = {
    activity: SentryTypes.IncidentActivity.isRequired,
    incident: SentryTypes.Incident,
    authorName: PropTypes.string,
  };

  render() {
    const {activity, authorName, incident} = this.props;

    const isCreated = activity.type === INCIDENT_ACTIVITY_TYPE.CREATED;
    const isDetected = activity.type === INCIDENT_ACTIVITY_TYPE.DETECTED;
    const isClosed =
      activity.type === INCIDENT_ACTIVITY_TYPE.STATUS_CHANGE &&
      activity.value === INCIDENT_STATUS.CLOSED;
    const isReopened =
      activity.type === INCIDENT_ACTIVITY_TYPE.STATUS_CHANGE &&
      activity.value === INCIDENT_STATUS.CREATED &&
      activity.previousValue === INCIDENT_STATUS.CLOSED;

    // Unknown activity, don't render anything
    if (!isCreated && !isDetected && !isClosed && !isReopened) {
      return null;
    }

    return (
      <ActivityItem
        showTime
        author={{
          type: activity.user ? 'user' : 'system',
          user: activity.user,
        }}
        header={
          <div>
            <AuthorName>{authorName}</AuthorName> {isCreated && t('created')}
            {isDetected && t('detected')}
            {isClosed && t('closed')}
            {isReopened && t('re-opened')} {t('an Incident')}
          </div>
        }
        date={activity.dateCreated}
      >
        {activity.eventStats && (
          <Chart
            data={activity.eventStats.data}
            detected={(isCreated || isDetected) && incident && incident.dateStarted}
          />
        )}
      </ActivityItem>
    );
  }
}

export default StatusItem;

const AuthorName = styled('span')`
  font-weight: bold;
`;
