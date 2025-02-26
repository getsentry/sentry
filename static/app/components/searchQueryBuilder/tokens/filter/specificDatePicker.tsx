import {
  type ForwardedRef,
  forwardRef,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {DatePicker} from 'sentry/components/calendar';
import Checkbox from 'sentry/components/checkbox';
import type {SelectOptionWithKey} from 'sentry/components/compactSelect/types';
import {Input} from 'sentry/components/core/input';
import {Overlay} from 'sentry/components/overlay';
import type {CustomComboboxMenuProps} from 'sentry/components/searchQueryBuilder/tokens/combobox';
import {parseFilterValueDate} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/date/parser';
import {Token} from 'sentry/components/searchSyntax/parser';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DEFAULT_DAY_START_TIME, getInternalDate} from 'sentry/utils/dates';
import mergeRefs from 'sentry/utils/mergeRefs';

interface SearchBarDatePickerProps
  extends CustomComboboxMenuProps<SelectOptionWithKey<string>> {
  handleSelectDateTime: (value: string) => void;
  isOpen: boolean;
  dateString?: string;
  handleBack?: () => void;
  handleSave?: (value: string) => void;
}

type TimeInputProps = {
  disabled: boolean;
  setTime: (newTime: string) => void;
  time: string;
};

const ISO_DATE_FORMAT = 'YYYY-MM-DD';

function createDateStringFromSelection({
  date = new Date(),
  time,
  utc,
}: {
  date?: Date;
  time?: string;
  utc?: boolean;
}) {
  const dateString = moment(date).local().format(ISO_DATE_FORMAT);

  if (!time) {
    return dateString;
  }

  const dateWithTimeString = `${dateString}T${time}`;

  if (utc) {
    return dateWithTimeString + 'Z';
  }

  return dateWithTimeString + moment().format('Z');
}

function SpecificDatePicker({
  popoverRef,
  dateString,
  handleSelectDateTime,
  handleBack,
  handleSave,
  isOpen,
  overlayProps,
}: SearchBarDatePickerProps) {
  const parsedToken = useMemo(() => {
    if (!dateString) {
      return null;
    }

    const parsed = parseFilterValueDate(dateString);
    if (parsed?.type !== Token.VALUE_ISO_8601_DATE) {
      return null;
    }

    return parsed;
  }, [dateString]);

  // DatePicker needs a Date object, but if we pass it in as-is it may
  // display the wrong date due to timezone differences.
  const internalDate = useMemo<Date | undefined>(() => {
    if (!parsedToken) {
      return undefined;
    }

    return getInternalDate(parsedToken.date, true);
  }, [parsedToken]);

  const time = parsedToken?.time;
  const utc = !parsedToken?.tz || parsedToken?.tz === 'Z' ? true : false;
  const hasTime = Boolean(parsedToken?.time);

  return (
    <StyledPositionWrapper {...overlayProps} visible={isOpen}>
      <SearchBarDatePickerOverlay
        data-test-id="specific-date-picker"
        ref={popoverRef}
        // Otherwise clicks will propagate to the grid and close the dropdown
        onClick={e => e.stopPropagation()}
      >
        {isOpen ? (
          <Fragment>
            <DatePicker
              date={internalDate}
              onChange={newDate => {
                if (newDate instanceof Date) {
                  handleSelectDateTime(
                    createDateStringFromSelection({
                      date: getInternalDate(newDate, utc),
                      time,
                      utc,
                    })
                  );
                }
              }}
            />
            <ControlsWrapper>
              <CheckboxLabel>
                <Checkbox
                  checked={hasTime}
                  onChange={e => {
                    if (e.target.checked) {
                      handleSelectDateTime(
                        createDateStringFromSelection({
                          date: internalDate,
                          time: DEFAULT_DAY_START_TIME,
                          utc,
                        })
                      );
                    } else {
                      handleSelectDateTime(
                        createDateStringFromSelection({
                          date: internalDate,
                          utc: true,
                        })
                      );
                    }
                  }}
                />
                {t('Include time')}
              </CheckboxLabel>
              <TimeUtcWrapper>
                <TimeInput
                  disabled={!hasTime}
                  time={time ?? DEFAULT_DAY_START_TIME}
                  setTime={newTime => {
                    handleSelectDateTime(
                      createDateStringFromSelection({
                        date: internalDate,
                        time: newTime,
                        utc,
                      })
                    );
                  }}
                />
                <UtcPickerLabel>
                  {t('UTC')}
                  <Checkbox
                    disabled={!hasTime}
                    onChange={e => {
                      handleSelectDateTime(
                        createDateStringFromSelection({
                          date: internalDate,
                          time,
                          utc: e.target.checked,
                        })
                      );
                    }}
                    checked={utc}
                  />
                </UtcPickerLabel>
              </TimeUtcWrapper>
            </ControlsWrapper>
            <ButtonsFooter>
              <ButtonBar gap={1}>
                <Button
                  size="xs"
                  icon={<IconArrow direction="left" />}
                  onClick={handleBack}
                >
                  {t('Back')}
                </Button>
                <Button
                  size="xs"
                  priority="primary"
                  disabled={!dateString}
                  onClick={() => {
                    handleSave?.(dateString!);
                  }}
                >
                  {t('Save')}
                </Button>
              </ButtonBar>
            </ButtonsFooter>
          </Fragment>
        ) : null}
      </SearchBarDatePickerOverlay>
    </StyledPositionWrapper>
  );
}

/**
 * This component keeps track of its own state because updates bring focus
 * back to the search bar. We make sure to keep focus within the input
 * until the user is done making changes.
 */
const TimeInput = forwardRef(
  ({disabled, time, setTime}: TimeInputProps, ref: ForwardedRef<HTMLInputElement>) => {
    const [localTime, setLocalTime] = useState(time);
    const [isFocused, setIsFocused] = useState(false);
    const timeInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      setLocalTime(time);
    }, [time]);

    return (
      <StyledInput
        ref={mergeRefs([ref, timeInputRef])}
        aria-label={t('Time')}
        disabled={disabled}
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
          setTime(localTime);
          setIsFocused(false);
        }}
        onFocus={() => setIsFocused(true)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            setTime(localTime);
            timeInputRef.current?.blur();
          }
          e.stopPropagation();
        }}
        onClick={e => {
          e.stopPropagation();
        }}
        value={localTime}
        step={1}
      />
    );
  }
);

const StyledPositionWrapper = styled('div')<{visible?: boolean}>`
  display: ${p => (p.visible ? 'block' : 'none')};
  z-index: ${p => p.theme.zIndex.tooltip};
`;

const SearchBarDatePickerOverlay = styled(Overlay)`
  min-width: 332px;
  min-height: 380px;
  cursor: default;
`;

const StyledInput = styled(Input)`
  resize: none;
`;

const ControlsWrapper = styled('div')`
  padding: ${space(1.5)} ${space(2)};
  border-top: 1px solid ${p => p.theme.innerBorder};
`;

const TimeUtcWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(2)};
  margin-top: ${space(1)};
`;

const UtcPickerLabel = styled('label')`
  color: ${p => p.theme.textColor};
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin: 0;
  font-weight: ${p => p.theme.fontWeightNormal};
  user-select: none;
  gap: ${space(1)};
  cursor: pointer;

  &:has(:disabled) {
    cursor: not-allowed;
    color: ${p => p.theme.disabled};
  }
`;

const CheckboxLabel = styled('label')`
  display: inline-flex;
  align-items: center;
  margin: 0;
  gap: ${space(1)};
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.textColor};
  cursor: pointer;
`;

const ButtonsFooter = styled(ControlsWrapper)`
  display: flex;
  justify-content: flex-end;
`;

export default SpecificDatePicker;
