import React, {useState} from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import moment from 'moment';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DropdownButton from 'sentry/components/dropdownButton';
import {Content} from 'sentry/components/dropdownControl';
import DropdownMenu from 'sentry/components/dropdownMenu';
import HookOrDefault from 'sentry/components/hookOrDefault';
import MultipleSelectorSubmitRow from 'sentry/components/organizations/multipleSelectorSubmitRow';
import {ChangeData} from 'sentry/components/organizations/timeRangeSelector';
import DateRange from 'sentry/components/organizations/timeRangeSelector/dateRange';
import {
  DEFAULT_RELATIVE_PERIODS_PAGE_FILTER,
  DEFAULT_STATS_PERIOD,
} from 'sentry/constants';
import {t} from 'sentry/locale';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {
  getDateWithTimezoneInUtc,
  getInternalDate,
  getLocalToSystem,
  getPeriodAgo,
  getUserTimezone,
  getUtcToSystem,
  parsePeriodToHours,
} from 'sentry/utils/dates';
import useOrganization from 'sentry/utils/useOrganization';

const DateRangeHook = HookOrDefault({
  hookName: 'component:header-date-range',
  defaultComponent: DateRange,
});

type DateRangeChangeData = Parameters<
  React.ComponentProps<typeof DateRange>['onChange']
>[0];

type Props = {
  router: WithRouterProps['router'];
  /**
   * Set an optional default value to prefill absolute date with
   */
  defaultAbsolute?: {start?: Date; end?: Date};
  /**
   * Override DEFAULT_STATS_PERIOD
   */
  defaultPeriod?: string;
  /**
   * The maximum number of days in the past you can pick
   */
  maxPickableDays?: number;
  /**
   * Override defaults from DEFAULT_RELATIVE_PERIODS_PAGE_FILTER
   */
  relativeOptions?: Record<string, React.ReactChild>;
  /**
   * Reset these URL params when we fire actions (custom routing only)
   */
  resetParamsOnChange?: string[];
  /**
   * Show absolute date selection
   */
  showAbsolute?: boolean;
  /**
   * Show relative date options
   */
  showRelative?: boolean;
};

function DatePageFilter({
  router,
  defaultAbsolute,
  defaultPeriod,
  maxPickableDays,
  relativeOptions,
  resetParamsOnChange = [],
  showAbsolute = true,
  showRelative = true,
}: Props) {
  const organization = useOrganization();
  const {selection} = useLegacyStore(PageFiltersStore);

  const getStartFromRelativePeriod = () => {
    return defaultAbsolute?.start
      ? defaultAbsolute.start
      : getPeriodAgo(
          'hours',
          parsePeriodToHours(
            selection.datetime.period || defaultPeriod || DEFAULT_STATS_PERIOD
          )
        ).toDate();
  };

  const getEndFromRelativePeriod = () => {
    return defaultAbsolute?.end ? defaultAbsolute.end : new Date();
  };

  const selectionStart = selection.datetime.start;
  const selectionEnd = selection.datetime.end;
  // if utc is not null and not undefined, then use value of `selection.datetime.utc` (it can be false)
  // otherwise if no value is supplied, the default should be the user's timezone preference
  const selectionUtc = defined(selection.datetime.utc)
    ? selection.datetime.utc
    : getUserTimezone() === 'UTC';

  // convert current selection.datetime start values into dates for the DateRange hook
  // or generate them from the currently selected relative period
  const startDate =
    selectionStart && selectionEnd
      ? getInternalDate(selectionStart, selectionUtc)
      : getStartFromRelativePeriod();
  const endDate =
    selectionStart && selectionEnd
      ? getInternalDate(selectionEnd, selectionUtc)
      : getEndFromRelativePeriod();

  const [selectedTimePeriod, setSelectedTimePeriod] = useState<ChangeData>({
    relative: selection.datetime.period,
    start: startDate,
    end: endDate,
    utc: selectionUtc,
  });
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [hasDateErrors, setHasDateErrors] = useState<boolean>(false);

  const getDateSummary = () => {
    const {relative, start, end} = selectedTimePeriod;
    if (relative || !start || !end) {
      return t('Custom');
    }

    const formattedStart = moment(start).local().format('MMM DD');
    const formattedEnd = moment(end).local().format('MMM DD');
    return `${formattedStart} - ${formattedEnd}`;
  };

  const handleUpdate = (timePeriodUpdate: ChangeData) => {
    const {relative, start, end, utc} = timePeriodUpdate;
    const newTimePeriod = {
      period: relative,
      start,
      end,
      utc,
    };

    updateDateTime(newTimePeriod, router, {save: true, resetParams: resetParamsOnChange});
    setHasChanges(false);
  };

  const handleChangeDateRange = ({
    start,
    end,
    hasDateRangeErrors = false,
  }: DateRangeChangeData) => {
    if (hasDateRangeErrors) {
      setHasDateErrors(hasDateRangeErrors);
      return;
    }

    const newDateTime: ChangeData = {
      relative: null,
      start,
      end,
      utc: selectedTimePeriod.utc,
    };

    setHasChanges(true);
    setHasDateErrors(hasDateRangeErrors);
    setSelectedTimePeriod(newDateTime);
  };

  const handleCloseDateSelector = () => {
    if (!hasChanges) {
      return;
    }

    handleUpdate(selectedTimePeriod);
  };

  const handleUseUtc = () => {
    const utc = !selectedTimePeriod.utc;
    let {start, end} = selection.datetime;

    if (!start) {
      start = getDateWithTimezoneInUtc(selectedTimePeriod.start, utc);
    }

    if (!end) {
      end = getDateWithTimezoneInUtc(selectedTimePeriod.end, utc);
    }

    const newDateTime = {
      relative: null,
      start: utc ? getLocalToSystem(start) : getUtcToSystem(start),
      end: utc ? getLocalToSystem(end) : getUtcToSystem(end),
      utc,
    };

    setHasChanges(true);
    setSelectedTimePeriod(newDateTime);
  };

  const handleSelectRelative = (value: string) => {
    const newDateTime: ChangeData = {
      relative: value,
      start: undefined,
      end: undefined,
    };

    setSelectedTimePeriod(newDateTime);
    handleUpdate(newDateTime);
  };

  return (
    <ButtonBar merged>
      {showRelative &&
        Object.entries(relativeOptions ?? DEFAULT_RELATIVE_PERIODS_PAGE_FILTER).map(
          ([value, label]) => (
            <RelativePeriodButton
              key={value}
              selected={value === selection.datetime.period}
              onClick={() => handleSelectRelative(value)}
            >
              {label}
            </RelativePeriodButton>
          )
        )}
      {showAbsolute && (
        <CustomDateOption>
          <DropdownMenu keepMenuOpen onClose={handleCloseDateSelector}>
            {({isOpen, getActorProps, getMenuProps, actions}) => (
              <React.Fragment>
                <CustomPeriodButton
                  isOpen={isOpen}
                  {...getActorProps()}
                  selected={!selection.datetime.period}
                  showRelative={showRelative}
                >
                  {getDateSummary()}
                </CustomPeriodButton>
                <Content
                  {...getMenuProps()}
                  alignMenu="right"
                  width="350px"
                  isOpen={isOpen}
                  blendCorner
                >
                  <DateRangeHook
                    start={selectedTimePeriod.start ?? getStartFromRelativePeriod()}
                    end={selectedTimePeriod.end ?? getEndFromRelativePeriod()}
                    organization={organization}
                    showTimePicker
                    utc={selectedTimePeriod.utc}
                    onChange={handleChangeDateRange}
                    onChangeUtc={handleUseUtc}
                    maxPickableDays={maxPickableDays}
                  />
                  <SubmitRow>
                    <MultipleSelectorSubmitRow
                      onSubmit={actions.close}
                      disabled={!hasChanges || hasDateErrors}
                    />
                  </SubmitRow>
                </Content>
              </React.Fragment>
            )}
          </DropdownMenu>
        </CustomDateOption>
      )}
    </ButtonBar>
  );
}

const RelativePeriodButton = styled(Button)<{selected?: boolean}>`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => (p.selected ? 700 : 400)};
  color: ${p => (p.selected ? p.theme.textColor : p.theme.subText)};
  ${p => p.selected && `background-color: ${p.theme.bodyBackground}`};
`;

const CustomPeriodButton = styled(DropdownButton)<{
  selected?: boolean;
  showRelative?: boolean;
}>`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => (p.selected ? 700 : 400)};
  color: ${p => (p.selected ? p.theme.textColor : p.theme.subText)};

  ${p =>
    p.showRelative &&
    `
    border-left: none;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  `}
`;

const CustomDateOption = styled('div')`
  display: inline-block;
  position: relative;
`;

const SubmitRow = styled('div')`
  padding: ${space(0.5)} ${space(1)};
  border-top: 1px solid ${p => p.theme.innerBorder};
  border-left: 1px solid ${p => p.theme.border};
`;

export default withRouter(DatePageFilter);
