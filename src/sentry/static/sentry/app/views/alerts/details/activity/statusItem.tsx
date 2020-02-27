import React from 'react';
import styled from '@emotion/styled';

import {tct} from 'app/locale';
import ActivityItem from 'app/components/activity/item';
import getDynamicText from 'app/utils/getDynamicText';

import {Incident, IncidentActivityType, IncidentStatus, ActivityType} from '../../types';

type Props = {
  activity: ActivityType;
  showTime: boolean;

  /**
   * Author name can be undefined if there is no author, e.g. if it's a system activity
   */
  authorName?: string;
  incident?: Incident;
};

/**
 * StatusItem renders status changes for Alerts
 *
 * For example: incident detected, or closed
 *
 * Note `activity.dateCreated` refers to when the activity was created vs.
 * `incident.dateStarted` which is when an incident was first detected or created
 */
class StatusItem extends React.Component<Props> {
  render() {
    const {activity, authorName, incident, showTime} = this.props;

    const isDetected = activity.type === IncidentActivityType.DETECTED;
    const isClosed =
      activity.type === IncidentActivityType.STATUS_CHANGE &&
      activity.value === `${IncidentStatus.CLOSED}`;

    // Unknown activity, don't render anything
    if (!isDetected && !isClosed) {
      return null;
    }

    return (
      <ActivityItem
        showTime={showTime}
        author={{
          type: activity.user ? 'user' : 'system',
          user: activity.user,
        }}
        header={
          <div>
            {isClosed &&
              tct('[user] resolved the alert', {
                user: <AuthorName>{authorName}</AuthorName>,
              })}
            {isDetected &&
              (incident?.alertRule
                ? tct('[user] was triggered', {
                    user: <AuthorName>{incident.alertRule.name}</AuthorName>,
                  })
                : tct('[user] created an alert', {
                    user: <AuthorName>{authorName}</AuthorName>,
                  }))}
          </div>
        }
        date={getDynamicText({value: activity.dateCreated, fixed: new Date(0)})}
      />
    );
  }
}

export default StatusItem;

const AuthorName = styled('span')`
  font-weight: bold;
`;
