import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import format from 'date-fns/format';
import type {Moment} from 'moment';

import {DatePicker} from 'sentry/components/calendar';
import Checkbox from 'sentry/components/checkbox';
import {Overlay} from 'sentry/components/overlay';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DEFAULT_DAY_START_TIME, setDateToTime} from 'sentry/utils/dates';

type SearchBarDatePickerProps = {
  handleSelectDateTime: (value: string) => void;
  date?: Moment;
  dateString?: string;
};

type TimeInputProps = {
  setTime: (newTime: string) => void;
  time: string;
};

const TZ_OFFSET_REGEX = /[+-]\d\d:\d\d$/;
const TIME_REGEX = /T\d\d:\d\d:\d\d/;

const ISO_FORMAT = "yyyy-MM-dd'T'HH:mm:ss";
const ISO_FORMAT_WITH_TIMEZONE = ISO_FORMAT + 'xxx';

const isUtcIsoDate = (isoDateTime?: string) => {
  if (!isoDateTime) {
    return false;
  }

  return !TZ_OFFSET_REGEX.test(isoDateTime);
};

const applyChanges = ({
  date = new Date(),
  timeString = DEFAULT_DAY_START_TIME,
  handleSelectDateTime,
  utc = false,
}: {
  handleSelectDateTime: (isoDateString: string) => void;
  date?: Date;
  timeString?: string;
  utc?: boolean;
}) => {
  const newDate = setDateToTime(date, timeString, {local: true});

  handleSelectDateTime(format(newDate, utc ? ISO_FORMAT : ISO_FORMAT_WITH_TIMEZONE));
};

const parseIncomingDateString = (incomingDateString?: string) => {
  if (!incomingDateString) {
    return undefined;
  }

  // For consistent date parsing, remove timezone from the incoming date string
  const strippedTimeZone = incomingDateString
    .replace(TZ_OFFSET_REGEX, '')
    .replace(/Z$/, '');

  if (TIME_REGEX.test(incomingDateString)) {
    return new Date(strippedTimeZone);
  }

  return new Date(strippedTimeZone + 'T00:00:00');
};

function SearchBarDatePicker({
  dateString,
  handleSelectDateTime,
}: SearchBarDatePickerProps) {
  const incomingDate = parseIncomingDateString(dateString);

  const time = incomingDate ? format(incomingDate, 'HH:mm:ss') : DEFAULT_DAY_START_TIME;

  const utc = isUtcIsoDate(dateString);

  return (
    <SearchBarDatePickerOverlay
      onMouseDown={e => e.stopPropagation()}
      data-test-id="search-bar-date-picker"
    >
      <DatePicker
        date={incomingDate}
        onChange={newDate => {
          if (newDate instanceof Date) {
            applyChanges({
              date: newDate,
              timeString: time,
              utc,
              handleSelectDateTime,
            });
          }
        }}
      />
      <DatePickerFooter>
        <TimeInput
          time={time}
          setTime={newTime => {
            applyChanges({
              date: incomingDate,
              timeString: newTime,
              utc,
              handleSelectDateTime,
            });
          }}
        />
        <UtcPickerLabel>
          {t('Use UTC')}
          <Checkbox
            onChange={e => {
              applyChanges({
                date: incomingDate,
                timeString: time,
                utc: e.target.checked,
                handleSelectDateTime,
              });
            }}
            checked={utc}
          />
        </UtcPickerLabel>
      </DatePickerFooter>
    </SearchBarDatePickerOverlay>
  );
}

/**
 * This component keeps track of its own state because updates bring focus
 * back to the search bar. We make sure to keep focus within the input
 * until the user is done making changes.
 */
function TimeInput({time, setTime}: TimeInputProps) {
  const [localTime, setLocalTime] = useState(time);
  const [isFocused, setIsFocused] = useState(false);
  const timeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLocalTime(time);
  }, [time]);

  return (
    <Input
      ref={timeInputRef}
      aria-label="Time"
      type="time"
      data-test-id="search-bar-date-picker-time-input"
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const newStartTime = e.target.value || DEFAULT_DAY_START_TIME;
        setLocalTime(newStartTime);

        if (!isFocused) {
          setTime(newStartTime);
        }
      }}
      onBlur={() => {
        setIsFocused(false);
        setTime(localTime);
      }}
      onFocus={() => setIsFocused(true)}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          timeInputRef.current?.blur();
        }
      }}
      onClick={e => {
        e.stopPropagation();
      }}
      value={localTime}
      step={1}
    />
  );
}

const SearchBarDatePickerOverlay = styled(Overlay)`
  position: absolute;
  top: 100%;
  left: -1px;
  overflow: hidden;
  margin-top: ${space(1)};
`;

const Input = styled('input')`
  border-radius: 4px;
  padding: 0 ${space(1)};
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.border};
  color: ${p => p.theme.gray300};
  box-shadow: none;
`;

const DatePickerFooter = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(1)} ${space(3)} ${space(3)} ${space(3)};
`;

const UtcPickerLabel = styled('label')`
  color: ${p => p.theme.gray300};
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin: 0;
  font-weight: normal;
  user-select: none;
  cursor: pointer;
  gap: ${space(1)};
`;

export default SearchBarDatePicker;
