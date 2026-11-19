import styled from '@emotion/styled';
import {IconCalendar} from '@sentry/icons/calendar';

import {formatDateTime, type DateTimeOptions} from '@sentry/scraps/dateTime';
import {Stack} from '@sentry/scraps/layout';

import {AlertBadge} from 'sentry/components/core/badge/alertBadge';
import {IncidentStatus} from 'sentry/views/alerts/types';

import type {SpikeDetails} from 'getsentry/views/spikeProtection/types';

export function SpikeProtectionTimeDetails({spike}: {spike: SpikeDetails}) {
  const {start, end} = spike;
  const format = {
    mode: 'time',
    showTimezone: false,
    timezone: 'UTC',
  } satisfies DateTimeOptions;
  const formattedTime = end
    ? `${formatDateTime(start, format)} - ${formatDateTime(end, format)}`
    : `${formatDateTime(start, format)} - present`;
  const [startDate, endDate] = [start, end].map(d =>
    d
      ? formatDateTime(d, {
          mode: 'date',
          year: 'always',
          showTimezone: false,
          timezone: 'UTC',
        })
      : undefined
  );
  const dateFormat =
    startDate === endDate
      ? startDate
      : end
        ? `${startDate} - ${endDate}`
        : `${startDate} - present`;

  return (
    <SpikeTimeDetailsWrapper>
      <AlertBadge status={IncidentStatus.CRITICAL} />
      <Stack>
        <strong>{formattedTime.toLowerCase()}</strong>
        <span>
          <StyledIconCalendar size="xs" variant="muted" />
          {dateFormat}
        </span>
      </Stack>
    </SpikeTimeDetailsWrapper>
  );
}

const SpikeTimeDetailsWrapper = styled('div')`
  display: grid;
  grid-template-columns: 40px auto;
  gap: ${p => p.theme.space.md};
  strong {
    display: block;
    white-space: nowrap;
  }
  span {
    color: ${p => p.theme.tokens.content.secondary};
    display: inline-block;
  }
`;

const StyledIconCalendar = styled(IconCalendar)`
  margin-right: ${p => p.theme.space.xs};
`;
