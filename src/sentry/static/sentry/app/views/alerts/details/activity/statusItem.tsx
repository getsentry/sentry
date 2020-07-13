import React from 'react';
import styled from '@emotion/styled';

import {t, tct} from 'app/locale';
import ActivityItem from 'app/components/activity/item';
import getDynamicText from 'app/utils/getDynamicText';

import {
  Incident,
  IncidentActivityType,
  IncidentStatus,
  ActivityType,
  IncidentStatusMethod,
} from '../../types';

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
    const isStarted = activity.type === IncidentActivityType.STARTED;
    const isClosed =
      activity.type === IncidentActivityType.STATUS_CHANGE &&
      activity.value === `${IncidentStatus.CLOSED}`;
    const isTriggerChange =
      activity.type === IncidentActivityType.STATUS_CHANGE && !isClosed;

    // Unknown activity, don't render anything
    if (!isStarted && !isDetected && !isClosed && !isTriggerChange) {
      return null;
    }

    const currentTrigger = getTriggerName(activity.value);
    const previousTrigger = getTriggerName(activity.previousValue);

    return (
      <ActivityItem
        showTime={showTime}
        author={{
          type: activity.user ? 'user' : 'system',
          user: activity.user || undefined,
        }}
        header={
          <div>
            {isTriggerChange &&
              previousTrigger &&
              tct('Alert status changed from [previousTrigger] to [currentTrigger]', {
                previousTrigger,
                currentTrigger: <StatusValue>{currentTrigger}</StatusValue>,
              })}
            {isTriggerChange &&
              !previousTrigger &&
              tct('Alert status changed to [currentTrigger]', {
                currentTrigger: <StatusValue>{currentTrigger}</StatusValue>,
              })}
            {isClosed &&
              incident?.statusMethod === IncidentStatusMethod.RULE_UPDATED &&
              t(
                'This alert has been auto-resolved because the rule that triggered it has been modified or deleted.'
              )}
            {isClosed &&
              incident?.statusMethod !== IncidentStatusMethod.RULE_UPDATED &&
              tct('[user] resolved the alert', {
                user: <StatusValue>{authorName}</StatusValue>,
              })}
            {isDetected &&
              (incident?.alertRule
                ? t('Alert was created')
                : tct('[user] created an alert', {
                    user: <StatusValue>{authorName}</StatusValue>,
                  }))}
            {isStarted && t('Trigger conditions were met for the interval')}
          </div>
        }
        date={getDynamicText({value: activity.dateCreated, fixed: new Date(0)})}
        interval={isStarted ? incident?.alertRule.timeWindow : undefined}
      />
    );
  }
}

export default StatusItem;

const StatusValue = styled('span')`
  font-weight: bold;
`;

function getTriggerName(value: string | null) {
  if (value === `${IncidentStatus.WARNING}`) {
    return t('Warning');
  }

  if (value === `${IncidentStatus.CRITICAL}`) {
    return t('Critical');
  }

  // Otherwise, activity type is not status change
  return '';
}
