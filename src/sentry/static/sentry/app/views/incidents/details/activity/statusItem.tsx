import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import ActivityItem from 'app/components/activity/item';
import getDynamicText from 'app/utils/getDynamicText';

import {IncidentActivityType, IncidentStatus, ActivityType} from '../../types';

type Props = {
  activity: ActivityType;
  authorName: string;
  showTime: boolean;
};

/**
 * StatusItem renders status changes for Incidents
 *
 * For example: incident created, detected, or closed
 *
 * Note `activity.dateCreated` refers to when the activity was created vs.
 * `incident.dateStarted` which is when an incident was first detected or created
 */
class StatusItem extends React.Component<Props> {
  render() {
    const {activity, authorName, showTime} = this.props;

    const isCreated = activity.type === IncidentActivityType.CREATED;
    const isDetected = activity.type === IncidentActivityType.DETECTED;
    const isClosed =
      activity.type === IncidentActivityType.STATUS_CHANGE &&
      activity.value === `${IncidentStatus.CLOSED}`;
    const isReopened =
      activity.type === IncidentActivityType.STATUS_CHANGE &&
      activity.value === `${IncidentStatus.CREATED}` &&
      activity.previousValue === `${IncidentStatus.CLOSED}`;

    // Unknown activity, don't render anything
    if (!isCreated && !isDetected && !isClosed && !isReopened) {
      return null;
    }

    return (
      <ActivityItem
        bubbleProps={{
          borderColor: 'transparent',
        }}
        showTime={showTime}
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
        date={getDynamicText({value: activity.dateCreated, fixed: new Date(0)})}
      />
    );
  }
}

export default StatusItem;

const AuthorName = styled('span')`
  font-weight: bold;
`;
