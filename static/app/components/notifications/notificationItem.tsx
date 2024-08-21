import styled from '@emotion/styled';
import moment from 'moment';

import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import {Timestamp} from 'sentry/components/events/breadcrumbs/breadcrumbsTimeline';
import Timeline from 'sentry/components/timeline';
import {Tooltip} from 'sentry/components/tooltip';
import {IconSubscribed} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {NotificationHistory} from 'sentry/types/notifications';
import {shouldUse24Hours} from 'sentry/utils/dates';

export function NotificationItem({notification}: {notification: NotificationHistory}) {
  const absoluteFormat = shouldUse24Hours() ? 'HH:mm:ss.SSS' : 'hh:mm:ss.SSS';
  const now = new Date();
  const notifTime = new Date(notification.date_added);
  return (
    <Item
      icon={<IconSubscribed size="xs" />}
      title={notification.title}
      isActive
      timestamp={
        <Timestamp>
          <Tooltip
            title={<DateTime date={notifTime} format={`ll - ${absoluteFormat} (z)`} />}
          >
            <Duration seconds={moment(notifTime).diff(moment(now), 's')} abbreviation />
          </Tooltip>
        </Timestamp>
      }
    >
      {notification.description}
    </Item>
  );
}

const Item = styled(Timeline.Item)`
  border: 1px solid ${p => p.theme.border};
  padding: ${space(1.5)} ${space(3)};
  border-radius: ${p => p.theme.borderRadius};
  margin: ${space(2)} 0;
`;
