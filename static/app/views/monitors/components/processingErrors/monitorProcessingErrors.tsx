import {useState} from 'react';
import styled from '@emotion/styled';
import groupBy from 'lodash/groupBy';

import Accordion from 'sentry/components/accordion/accordion';
import Alert from 'sentry/components/alert';
import Tag from 'sentry/components/badge/tag';
import {DateTime} from 'sentry/components/dateTime';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ProcessingErrorItem} from 'sentry/views/monitors/components/processingErrors/processingErrorItem';
import {ProcessingErrorTitle} from 'sentry/views/monitors/components/processingErrors/processingErrorTitle';
import type {CheckInPayload, CheckinProcessingError} from 'sentry/views/monitors/types';

export default function MonitorProcessingErrors({
  checkinErrors,
}: {
  checkinErrors: CheckinProcessingError[];
}) {
  const flattenedErrors = checkinErrors.flatMap(({errors, checkin}) =>
    errors.map(error => ({error, checkin}))
  );
  const errorsByType = groupBy(flattenedErrors, ({error}) => error.type);

  const renderCheckinTooltip = (checkin: CheckInPayload) => (
    <Tooltip
      skipWrapper
      showUnderline
      title={
        <div>
          {tct('[status] check-in sent on [date]', {
            status: checkin.payload.status,
            date: <DateTime timeZone date={checkin.message.start_time * 1000} />,
          })}
        </div>
      }
    />
  );

  const [expanded, setExpanded] = useState(-1);
  const accordionErrors = (
    <Accordion
      items={Object.values(errorsByType).map(errors => ({
        header: (
          <ErrorHeader>
            <Tag type="error">{errors.length}x</Tag>
            <ProcessingErrorTitle type={errors[0].error.type} />
          </ErrorHeader>
        ),
        content: (
          <List symbol="bullet">
            {errors.map(({error, checkin}, i) => (
              <ListItem key={i}>
                <ProcessingErrorItem
                  error={error}
                  checkinTooltip={renderCheckinTooltip(checkin)}
                />
              </ListItem>
            ))}
          </List>
        ),
      }))}
      expandedIndex={expanded}
      setExpandedIndex={setExpanded}
    />
  );

  return (
    <ScrollableAlert type="error" showIcon expand={accordionErrors}>
      {t('Errors were encountered while ingesting check-ins for this monitor')}
    </ScrollableAlert>
  );
}

const ErrorHeader = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const ScrollableAlert = styled(Alert)`
  max-height: 400px;
  overflow-y: auto;
`;
