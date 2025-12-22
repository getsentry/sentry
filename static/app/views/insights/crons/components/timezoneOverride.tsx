import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import type {Monitor} from 'sentry/views/insights/crons/types';

interface TimezoneOverrideProps {
  monitor: Monitor;
  onTimezoneSelected: (timezone: string) => void;
  userTimezone: string;
}

type Mode = 'user' | 'monitor' | 'utc';

export function TimezoneOverride({
  monitor,
  onTimezoneSelected,
  userTimezone,
}: TimezoneOverrideProps) {
  const monitorTimezone = monitor.config.timezone ?? 'UTC';

  const [mode, setMode] = useState<Mode>('user');

  const timezoneMapping = useMemo<Record<Mode, string>>(
    () => ({
      user: userTimezone,
      monitor: monitorTimezone,
      utc: 'UTC',
    }),
    [monitorTimezone, userTimezone]
  );

  const handleChange = useCallback(
    (newMode: Mode) => {
      setMode(newMode);
      onTimezoneSelected(timezoneMapping[newMode]);
    },
    [onTimezoneSelected, timezoneMapping]
  );

  return (
    <CompactSelect
      size="xs"
      value={mode}
      position="bottom-end"
      onChange={option => handleChange(option.value)}
      triggerProps={{prefix: t('Date Display')}}
      options={[
        {
          value: 'user',
          label: 'My Timezone',
          trailingItems: <TimezoneLabel timezone={userTimezone} />,
        },
        {
          value: 'monitor',
          label: 'Monitor',
          trailingItems: <TimezoneLabel timezone={monitorTimezone} />,
        },
        {
          value: 'utc',
          label: 'UTC',
          trailingItems: <TimezoneLabel timezone="UTC" />,
        },
      ]}
    />
  );
}

function TimezoneLabel({timezone}: {timezone: string}) {
  return <TimezoneName>{moment.tz(timezone).format('z Z')}</TimezoneName>;
}

const TimezoneName = styled('div')`
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.bold};
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSize.sm};
  width: max-content;
`;
