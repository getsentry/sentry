import styled from '@emotion/styled';

import {AlertBadge} from 'sentry/components/core/badge/alertBadge';
import {IconCalendar} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {getFormat, getFormattedDate} from 'sentry/utils/dates';
import {IncidentStatus} from 'sentry/views/alerts/types';

import type {SpikeDetails} from 'getsentry/views/spikeProtection/types';

function SpikeProtectionTimeDetails({spike}: {spike: SpikeDetails}) {
  const {start, end} = spike;
  const format = getFormat({timeOnly: true});
  const formattedTime = end
    ? `${getFormattedDate(start, format)} - ${getFormattedDate(end, format)}`
    : `${getFormattedDate(start, format)} - present`;
  const [startDate, endDate] = [start, end].map(d =>
    getFormattedDate(d, getFormat({dateOnly: true, year: true}))
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
      <SpikeTimeDetailsTextWrapper>
        <strong>{formattedTime.toLowerCase()}</strong>
        <span>
          <StyledIconCalendar size="xs" color="gray300" />
          {dateFormat}
        </span>
      </SpikeTimeDetailsTextWrapper>
    </SpikeTimeDetailsWrapper>
  );
}

export default SpikeProtectionTimeDetails;

const SpikeTimeDetailsWrapper = styled('div')`
  display: grid;
  grid-template-columns: 40px auto;
  gap: ${space(1)};
  strong {
    display: block;
    white-space: nowrap;
  }
  span {
    color: ${p => p.theme.subText};
    display: inline-block;
  }
`;

const SpikeTimeDetailsTextWrapper = styled('div')`
  display: flex;
  flex-direction: column;
`;

const StyledIconCalendar = styled(IconCalendar)`
  margin-right: ${space(0.5)};
`;
