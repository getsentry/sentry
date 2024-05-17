import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {DateTime} from 'sentry/components/dateTime';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {ProcessingErrorItem} from 'sentry/views/monitors/components/processingErrors/processingErrorItem';
import type {CheckInPayload, CheckinProcessingError} from 'sentry/views/monitors/types';

export default function MonitorProcessingErrors({
  checkinErrors,
}: {
  checkinErrors: CheckinProcessingError[];
}) {
  const flattenedErrors = checkinErrors.flatMap(({errors, checkin}) =>
    errors.map(error => ({error, checkin}))
  );

  const renderCheckinTooltip = (checkin: CheckInPayload) => (
    <Tooltip
      skipWrapper
      title={
        <div>
          {tct('[status] check-in sent on [date]', {
            status: checkin.payload.status,
            date: <DateTime timeZone date={checkin.message.start_time * 1000} />,
          })}
        </div>
      }
      showUnderline
    />
  );

  return (
    <ScrollableAlert
      type="error"
      showIcon
      expand={
        <List symbol="bullet">
          {flattenedErrors.map(({error, checkin}, i) => (
            <ListItem key={i}>
              <ProcessingErrorItem
                error={error}
                checkinTooltip={renderCheckinTooltip(checkin)}
              />
            </ListItem>
          ))}
        </List>
      }
    >
      {t('Errors were encountered while ingesting check-ins for this monitor')}
    </ScrollableAlert>
  );
}

const ScrollableAlert = styled(Alert)`
  max-height: 400px;
  overflow-y: auto;
`;
