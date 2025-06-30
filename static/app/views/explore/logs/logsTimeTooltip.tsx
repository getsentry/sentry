import React, {Fragment} from 'react';
import styled from '@emotion/styled';

import AutoSelectText from 'sentry/components/autoSelectText';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DateTime} from 'sentry/components/dateTime';
import {useTimezone} from 'sentry/components/timezoneProvider';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

type Props = {
  attributes: Record<string, string | number | boolean>;
  children: React.ReactNode;
  timestamp: string | number;
  shouldRender?: boolean;
};

function TimestampTooltipBody({
  timestamp,
  attributes,
}: {
  attributes: Record<string, string | number | boolean>;
  timestamp: string | number;
}) {
  const currentTimezone = useTimezone();
  const preciseTimestamp = attributes[OurLogKnownFieldKey.TIMESTAMP_PRECISE];
  const preciseTimestampMs = preciseTimestamp
    ? Number(preciseTimestamp) / 1_000_000
    : null;
  const timestampToUse = preciseTimestampMs ? new Date(preciseTimestampMs) : timestamp;

  const observedTimeNanos = attributes[OurLogKnownFieldKey.OBSERVED_TIMESTAMP_PRECISE];
  const observedTimeMs =
    observedTimeNanos && typeof observedTimeNanos === 'string'
      ? Math.floor(Number(observedTimeNanos) / 1_000_000)
      : null;
  const observedTime = observedTimeMs ? new Date(observedTimeMs) : null;

  const isUTC = currentTimezone === 'UTC';

  return (
    <DescriptionList>
      <dt>{t('Occurred')}</dt>
      <dd>
        <TimestampValues>
          <AutoSelectText>
            <DateTime date={timestampToUse} seconds milliseconds timeZone />
          </AutoSelectText>
          {!isUTC && (
            <AutoSelectText>
              <DateTime date={timestampToUse} seconds milliseconds timeZone utc />
            </AutoSelectText>
          )}
          <TimestampLabel>
            ({preciseTimestampMs ? String(preciseTimestampMs) : String(timestamp)})
          </TimestampLabel>
        </TimestampValues>
      </dd>

      {observedTime && (
        <Fragment>
          <HorizontalRule />
          <dt>{t('Received')}</dt>
          <dd>
            <TimestampValues>
              <AutoSelectText>
                <DateTime date={observedTime} seconds timeZone />
              </AutoSelectText>
            </TimestampValues>
          </dd>
        </Fragment>
      )}
    </DescriptionList>
  );
}

export {TimestampTooltipBody};

export default function LogsTimestampTooltip({
  timestamp,
  attributes,
  children,
  shouldRender = true,
}: Props) {
  if (!shouldRender) {
    return <Fragment>{children}</Fragment>;
  }

  const handleTooltipPointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  return (
    <Tooltip
      title={
        <div onPointerUp={handleTooltipPointerUp}>
          <TimestampTooltipBody timestamp={timestamp} attributes={attributes} />
        </div>
      }
      maxWidth={400}
      isHoverable
    >
      {children}
    </Tooltip>
  );
}

const DescriptionList = styled('dl')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(0.75)} ${space(1)};
  text-align: left;
  margin: 0;
`;

const TimestampValues = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
  font-family: ${p => p.theme.text.familyMono};
`;

const HorizontalRule = styled('hr')`
  grid-column: 1 / -1;
  margin: ${space(0.5)} 0;
  border: none;
  border-top: 1px solid ${p => p.theme.border};
`;

const TimestampLabel = styled('span')`
  color: ${p => p.theme.gray400};
`;
