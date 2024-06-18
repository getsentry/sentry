import {useState} from 'react';
import styled from '@emotion/styled';
import groupBy from 'lodash/groupBy';

import Alert from 'sentry/components/alert';
import Tag from 'sentry/components/badge/tag';
import {Button} from 'sentry/components/button';
import {Chevron} from 'sentry/components/chevron';
import {DateTime} from 'sentry/components/dateTime';
import {Hovercard} from 'sentry/components/hovercard';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import StructuredEventData from 'sentry/components/structuredEventData';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {CheckInPayload, CheckinProcessingError} from 'sentry/views/monitors/types';

import {ProcessingErrorItem} from './processingErrorItem';
import {ProcessingErrorTitle} from './processingErrorTitle';

export default function MonitorProcessingErrors({
  checkinErrors,
  children,
}: {
  checkinErrors: CheckinProcessingError[];
  children: React.ReactNode;
}) {
  const flattenedErrors = checkinErrors.flatMap(({errors, checkin}) =>
    errors.map(error => ({error, checkin}))
  );
  const errorsByType = groupBy(flattenedErrors, ({error}) => error.type);

  const renderCheckinTooltip = (checkin: CheckInPayload) => (
    <StyledHovercard
      skipWrapper
      showUnderline
      header={tct('Check-in on [datetime]', {datetime: <DateTime date={checkin.ts} />})}
      body={
        // Prevent clicks inside the hovercard from closing the expandable alert
        <div onClick={e => e.stopPropagation()}>
          <StyledStructuredEventData
            data={checkin.payload}
            maxDefaultDepth={3}
            withAnnotatedText
            forceDefaultExpand
          />
        </div>
      }
    >
      {t('check-in')}
    </StyledHovercard>
  );

  const [expanded, setExpanded] = useState(-1);
  const accordionErrors = Object.values(errorsByType).map((errors, index) => {
    const isExpanded = expanded === index;
    return (
      <ErrorGroup key={index}>
        <ErrorHeader>
          <Tag type="error">{errors.length}x</Tag>
          <ProcessingErrorTitle type={errors[0].error.type} />

          <Button
            icon={<Chevron size="small" direction={isExpanded ? 'up' : 'down'} />}
            aria-label={isExpanded ? t('Collapse') : t('Expand')}
            aria-expanded={isExpanded}
            size="zero"
            borderless
            onClick={() => setExpanded(isExpanded ? -1 : index)}
          />
        </ErrorHeader>
        {isExpanded && (
          <List symbol="bullet">
            {errors.map(({error, checkin}, errorIndex) => (
              <ListItem key={errorIndex}>
                <ProcessingErrorItem
                  error={error}
                  checkinTooltip={renderCheckinTooltip(checkin)}
                />
              </ListItem>
            ))}
          </List>
        )}
      </ErrorGroup>
    );
  });

  return (
    <ScrollableAlert
      type="error"
      showIcon
      expand={<ErrorsList>{accordionErrors}</ErrorsList>}
    >
      {children}
    </ScrollableAlert>
  );
}

const ErrorsList = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const ErrorGroup = styled('div')`
  display: Flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const ErrorHeader = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const ScrollableAlert = styled(Alert)`
  max-height: 400px;
  overflow-y: auto;
`;

const StyledHovercard = styled(Hovercard)`
  width: 600px;
`;

const StyledStructuredEventData = styled(StructuredEventData)`
  margin: 0;
`;
