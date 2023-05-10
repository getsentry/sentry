import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {
  CompactSelect,
  SelectOption,
  SingleSelectProps,
} from 'sentry/components/compactSelect';
import {Item} from 'sentry/components/dropdownAutoComplete/types';
import DropdownButton from 'sentry/components/dropdownButton';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {ChangeData} from 'sentry/components/organizations/timeRangeSelector';
import DateRange from 'sentry/components/organizations/timeRangeSelector/dateRange';
import SelectorItems from 'sentry/components/organizations/timeRangeSelector/selectorItems';
import {
  getAbsoluteSummary,
  getDefaultRelativePeriods,
  timeRangeAutoCompleteFilter,
} from 'sentry/components/organizations/timeRangeSelector/utils';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {IconArrow, IconCalendar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DateString} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  getDateWithTimezoneInUtc,
  getInternalDate,
  getLocalToSystem,
  getPeriodAgo,
  getUserTimezone,
  getUtcToSystem,
  parsePeriodToHours,
} from 'sentry/utils/dates';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';

const ABSOLUTE_OPTION_VALUE = 'absolute';

const DateRangeHook = HookOrDefault({
  hookName: 'component:header-date-range',
  defaultComponent: DateRange,
});

const SelectorItemsHook = HookOrDefault({
  hookName: 'component:header-selector-items',
  defaultComponent: SelectorItems,
});

interface TimeRangeSelectorProps
  extends Omit<
    SingleSelectProps<string>,
    'options' | 'onChange' | 'closeOnSelect' | 'value' | 'defaultValue' | 'multiple'
  > {
  /**
   * Set an optional default value to prefill absolute date with
   */
  defaultAbsolute?: {end?: Date; start?: Date};
  /**
   * When the default period is selected, it is visually dimmed and makes the selector
   * unclearable.
   */
  defaultPeriod?: string;
  /**
   * Forces the user to select from the set of defined relative options
   */
  disallowArbitraryRelativeRanges?: boolean;
  /**
   * End date value for absolute date selector
   */
  end?: DateString;
  /**
   * The maximum number of days in the past you can pick
   */
  maxPickableDays?: number;
  onChange?: (data: ChangeData) => void;
  /**
   * Relative date value
   */
  relative?: string | null;
  /**
   * Override defaults from DEFAULT_RELATIVE_PERIODS
   */
  relativeOptions?: Record<string, React.ReactNode>;
  /**
   * Show absolute date selectors
   */
  showAbsolute?: boolean;
  /**
   * Show relative date selectors
   */
  showRelative?: boolean;
  /**
   * Start date value for absolute date selector
   */
  start?: DateString;
  /**
   * Default initial value for using UTC
   */
  utc?: boolean | null;
}

export function TimeRangeSelector({
  start,
  end,
  utc,
  relative,
  relativeOptions,
  onChange,
  showAbsolute = true,
  showRelative = true,
  defaultAbsolute,
  defaultPeriod = DEFAULT_STATS_PERIOD,
  maxPickableDays = 90,
  disallowArbitraryRelativeRanges = false,
  menuWidth,
  menuBody,
  ...selectProps
}: TimeRangeSelectorProps) {
  const router = useRouter();
  const organization = useOrganization();

  const [search, setSearch] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [hasDateRangeErrors, setHasDateRangeErrors] = useState(false);
  const [showAbsoluteSelector, setShowAbsoluteSelector] = useState(!showRelative);

  const [internalValue, setInternalValue] = useState<ChangeData>(() => {
    const internalUtc = utc ?? getUserTimezone() === 'UTC';

    return {
      start: start ? getInternalDate(start, internalUtc) : undefined,
      end: end ? getInternalDate(end, internalUtc) : undefined,
      utc: internalUtc,
      relative: relative ?? null,
    };
  });

  const getOptions = useCallback(
    (items: Item[]): SelectOption<string>[] => {
      // Return the default options if there's nothing in search
      if (!search) {
        return items.map(item => {
          if (item.value === 'absolute') {
            return {
              value: item.value,
              // Wrap inside OptionLabel to offset custom margins from SelectorItemLabel
              // TODO: Remove SelectorItemLabel & OptionLabel
              label: <OptionLabel>{item.label}</OptionLabel>,
              details:
                start && end ? (
                  <AbsoluteSummary>{getAbsoluteSummary(start, end, utc)}</AbsoluteSummary>
                ) : null,
              trailingItems: ({isFocused, isSelected}) => (
                <IconArrow
                  direction="right"
                  size="xs"
                  color={isFocused || isSelected ? undefined : 'subText'}
                />
              ),
              textValue: item.searchKey,
            };
          }

          return {
            value: item.value,
            label: <OptionLabel>{item.label}</OptionLabel>,
            textValue: item.searchKey,
          };
        });
      }

      const filteredItems = disallowArbitraryRelativeRanges
        ? items.filter(i => i.searchKey?.includes(search))
        : // If arbitrary relative ranges are allowed, then generate a list of them based
          // on the search query
          timeRangeAutoCompleteFilter(items, search, {
            maxDays: maxPickableDays,
          });

      return filteredItems.map(item => ({
        value: item.value,
        label: item.label,
        textValue: item.searchKey,
      }));
    },
    [start, end, utc, search, maxPickableDays, disallowArbitraryRelativeRanges]
  );

  const commitChanges = useCallback(() => {
    showRelative && setShowAbsoluteSelector(false);
    setSearch('');

    if (!hasChanges) {
      return;
    }

    setHasChanges(false);
    onChange?.(
      internalValue.start && internalValue.end
        ? {
            ...internalValue,
            start: getDateWithTimezoneInUtc(internalValue.start, internalValue.utc),
            end: getDateWithTimezoneInUtc(internalValue.end, internalValue.utc),
          }
        : internalValue
    );
  }, [showRelative, onChange, internalValue, hasChanges]);

  const handleChange = useCallback<NonNullable<SingleSelectProps<string>['onChange']>>(
    option => {
      // The absolute option was selected -> open absolute selector
      if (option.value === ABSOLUTE_OPTION_VALUE) {
        setInternalValue(current => ({
          ...current,
          // Update default values for absolute selector
          start: defaultAbsolute?.start
            ? defaultAbsolute.start
            : getPeriodAgo(
                'hours',
                parsePeriodToHours(relative || defaultPeriod || DEFAULT_STATS_PERIOD)
              ).toDate(),
          end: defaultAbsolute?.end ? defaultAbsolute.end : new Date(),
        }));
        setShowAbsoluteSelector(true);
        return;
      }

      setInternalValue(current => ({...current, relative: option.value}));
      onChange?.({relative: option.value, start: undefined, end: undefined});
    },
    [defaultAbsolute, defaultPeriod, relative, onChange]
  );

  return (
    <SelectorItemsHook
      shouldShowAbsolute={showAbsolute}
      shouldShowRelative={showRelative}
      relativePeriods={relativeOptions ?? getDefaultRelativePeriods(relative)}
      handleSelectRelative={value => handleChange({value})}
    >
      {items => (
        <CompactSelect
          searchable={!showAbsoluteSelector}
          disableSearchFilter
          onSearch={setSearch}
          searchPlaceholder={
            disallowArbitraryRelativeRanges
              ? t('Search…')
              : t('Custom range: 2h, 4d, 8w…')
          }
          options={getOptions(items)}
          hideOptions={showAbsoluteSelector}
          value={start && end ? ABSOLUTE_OPTION_VALUE : relative ?? ''}
          onChange={handleChange}
          // Keep menu open when clicking on absolute range option
          closeOnSelect={opt => opt.value !== ABSOLUTE_OPTION_VALUE}
          onClose={() => {
            setHasChanges(false);
            setSearch('');
          }}
          onInteractOutside={commitChanges}
          onKeyDown={e => e.key === 'Escape' && commitChanges()}
          trigger={triggerProps => {
            const relativeSummary =
              items.findIndex(item => item.value === relative) > -1
                ? relative?.toUpperCase()
                : t('Invalid Period');
            const defaultLabel =
              start && end ? getAbsoluteSummary(start, end, utc) : relativeSummary;

            return (
              <DropdownButton icon={<IconCalendar />} {...triggerProps}>
                <TriggerLabel>{selectProps.triggerLabel ?? defaultLabel}</TriggerLabel>
              </DropdownButton>
            );
          }}
          menuWidth={showAbsoluteSelector ? undefined : menuWidth ?? '16rem'}
          menuBody={
            (showAbsoluteSelector || menuBody) && (
              <Fragment>
                {!showAbsoluteSelector && menuBody}
                {showAbsoluteSelector && (
                  <AbsoluteDateRangeWrap>
                    <StyledDateRangeHook
                      start={internalValue.start ?? null}
                      end={internalValue.end ?? null}
                      utc={internalValue.utc}
                      organization={organization}
                      showTimePicker
                      onChange={val => {
                        val.hasDateRangeErrors && setHasDateRangeErrors(true);
                        setInternalValue(cur => ({
                          ...cur,
                          relative: null,
                          start: val.start,
                          end: val.end,
                        }));
                        setHasChanges(true);
                      }}
                      onChangeUtc={() => {
                        setHasChanges(true);
                        setInternalValue(current => {
                          const newUtc = !current.utc;
                          const newStart =
                            start ?? getDateWithTimezoneInUtc(current.start, current.utc);
                          const newEnd =
                            end ?? getDateWithTimezoneInUtc(current.end, current.utc);

                          trackAnalytics('dateselector.utc_changed', {
                            utc: newUtc,
                            path: getRouteStringFromRoutes(router.routes),
                            organization,
                          });

                          return {
                            relative: null,
                            start: newUtc
                              ? getLocalToSystem(newStart)
                              : getUtcToSystem(newStart),
                            end: newUtc
                              ? getLocalToSystem(newEnd)
                              : getUtcToSystem(newEnd),
                            utc: newUtc,
                          };
                        });
                      }}
                      maxPickableDays={maxPickableDays}
                    />
                  </AbsoluteDateRangeWrap>
                )}
              </Fragment>
            )
          }
          menuFooter={
            showAbsoluteSelector &&
            (({closeOverlay}) => (
              <AbsoluteSelectorFooter>
                {showRelative && (
                  <Button
                    size="xs"
                    borderless
                    icon={<IconArrow size="xs" direction="left" />}
                    onClick={() => setShowAbsoluteSelector(false)}
                  >
                    {t('Back')}
                  </Button>
                )}
                <Button
                  size="xs"
                  priority="primary"
                  disabled={!hasChanges || hasDateRangeErrors}
                  onClick={() => {
                    commitChanges();
                    closeOverlay();
                  }}
                >
                  {t('Apply')}
                </Button>
              </AbsoluteSelectorFooter>
            ))
          }
          {...selectProps}
        />
      )}
    </SelectorItemsHook>
  );
}

const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis}
  width: auto;
`;

const OptionLabel = styled('span')`
  /* Remove custom margin added by SelectorItemLabel. Once we update custom hooks and
  remove SelectorItemLabel, we can delete this. */
  div {
    margin: 0;
  }
`;

const AbsoluteSummary = styled('span')`
  time {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
`;

const AbsoluteDateRangeWrap = styled('div')`
  overflow: auto;
`;

const StyledDateRangeHook = styled(DateRangeHook)`
  border: none;
  width: max-content;
`;

const AbsoluteSelectorFooter = styled('div')`
  display: flex;
  gap: ${space(1)};
  justify-content: flex-end;
`;
