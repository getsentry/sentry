import {PureComponent} from 'react';
// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import {GetActorPropsFn} from 'sentry/components/deprecatedDropdownMenu';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import autoCompleteFilter from 'sentry/components/dropdownAutoComplete/autoCompleteFilter';
import {Item} from 'sentry/components/dropdownAutoComplete/types';
import HookOrDefault from 'sentry/components/hookOrDefault';
import HeaderItem from 'sentry/components/organizations/headerItem';
import MultipleSelectorSubmitRow from 'sentry/components/organizations/multipleSelectorSubmitRow';
import PageFilterPinButton from 'sentry/components/organizations/pageFilters/pageFilterPinButton';
import DateRange from 'sentry/components/organizations/timeRangeSelector/dateRange';
import DateSummary from 'sentry/components/organizations/timeRangeSelector/dateSummary';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {IconCalendar} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {DateString, Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {analytics} from 'sentry/utils/analytics';
import {
  getDateWithTimezoneInUtc,
  getInternalDate,
  getLocalToSystem,
  getPeriodAgo,
  getUserTimezone,
  getUtcToSystem,
  parsePeriodToHours,
} from 'sentry/utils/dates';
import getDynamicText from 'sentry/utils/getDynamicText';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';

import SelectorItems from './selectorItems';
import {getRelativeSummary, timeRangeAutoCompleteFilter} from './utils';

const DateRangeHook = HookOrDefault({
  hookName: 'component:header-date-range',
  defaultComponent: DateRange,
});

const SelectorItemsHook = HookOrDefault({
  hookName: 'component:header-selector-items',
  defaultComponent: SelectorItems,
});

export type ChangeData = {
  relative: string | null;
  end?: Date;
  start?: Date;
  utc?: boolean | null;
};

type DateRangeChangeData = Parameters<
  React.ComponentProps<typeof DateRange>['onChange']
>[0];

const defaultProps = {
  /**
   * Show absolute date selectors
   */
  showAbsolute: true,
  /**
   * Show relative date selectors
   */
  showRelative: true,
  /**
   * When the default period is selected, it is visually dimmed and
   * makes the selector unclearable.
   */
  defaultPeriod: DEFAULT_STATS_PERIOD,
  /**
   * This matches Sentry's retention limit of 90 days
   */
  maxPickableDays: 90,
  /**
   * Callback when value changes
   */
  onChange: (() => {}) as (data: ChangeData) => void,
};

type Props = WithRouterProps & {
  /**
   * End date value for absolute date selector
   */
  end: DateString;

  /**
   * Callback when "Update" button is clicked
   */
  onUpdate: (data: ChangeData) => void;

  /**
   * Just used for metrics
   */
  organization: Organization;

  /**
   * Relative date value
   */
  relative: string | null;

  /**
   * Start date value for absolute date selector
   */
  start: DateString;

  /**
   * Default initial value for using UTC
   */
  utc: boolean | null;

  /**
   * Aligns dropdown menu to left or right of button
   */
  alignDropdown?: 'left' | 'right';

  /**
   * Optionally render a custom dropdown button, instead of the default
   * <HeaderItem />
   */
  customDropdownButton?: (config: {
    getActorProps: GetActorPropsFn;
    isOpen: boolean;
  }) => React.ReactElement;

  /**
   * Set an optional default value to prefill absolute date with
   */
  defaultAbsolute?: {end?: Date; start?: Date};

  /**
   * Whether the menu should be detached from the actor
   */
  detached?: boolean;

  /**
   * Disable the dropdown
   */
  disabled?: boolean;

  /**
   * Forces the user to select from the set of defined relative options
   */
  disallowArbitraryRelativeRanges?: boolean;

  /**
   * Small info icon with tooltip hint text
   */
  hint?: string;

  /**
   * Replace the default calendar icon for label
   */
  label?: React.ReactNode;

  /**
   * The maximum number of days in the past you can pick
   */
  maxPickableDays?: number;

  /**
   * Callback when opening/closing dropdown date selector
   */
  onToggleSelector?: (isOpen: boolean) => void;

  /**
   * Override defaults from DEFAULT_RELATIVE_PERIODS
   */
  relativeOptions?: Record<string, React.ReactNode>;

  /**
   * Show the pin button in the dropdown's header actions
   */
  showPin?: boolean;
} & Partial<typeof defaultProps>;

type State = {
  hasChanges: boolean;
  hasDateRangeErrors: boolean;
  inputValue: string;
  isOpen: boolean;
  relative: string | null;
  end?: Date;
  start?: Date;
  utc?: boolean | null;
};

class TimeRangeSelector extends PureComponent<Props, State> {
  static defaultProps = defaultProps;

  constructor(props: Props) {
    super(props);

    let start: Date | undefined = undefined;
    let end: Date | undefined = undefined;

    if (props.start && props.end) {
      start = getInternalDate(props.start, props.utc);
      end = getInternalDate(props.end, props.utc);
    }

    this.state = {
      // if utc is not null and not undefined, then use value of `props.utc` (it can be false)
      // otherwise if no value is supplied, the default should be the user's timezone preference
      utc: defined(props.utc) ? props.utc : getUserTimezone() === 'UTC',
      inputValue: '',
      isOpen: false,
      hasChanges: false,
      hasDateRangeErrors: false,
      start,
      end,
      relative: props.relative,
    };
  }

  componentDidUpdate(_prevProps, prevState) {
    const {onToggleSelector} = this.props;
    const currState = this.state;

    if (onToggleSelector && prevState.isOpen !== currState.isOpen) {
      onToggleSelector(currState.isOpen);
    }
  }

  callCallback = (callback: Props['onChange'], datetime: ChangeData) => {
    if (typeof callback !== 'function') {
      return;
    }

    if (!datetime.start && !datetime.end) {
      callback(datetime);
      return;
    }

    // Change local date into either UTC or local time (local time defined by user preference)
    callback({
      ...datetime,
      start: getDateWithTimezoneInUtc(datetime.start, this.state.utc),
      end: getDateWithTimezoneInUtc(datetime.end, this.state.utc),
    });
  };

  handleCloseMenu = () => {
    const {relative, start, end, utc} = this.state;

    if (this.state.hasChanges) {
      // Only call update if we close when absolute date is selected
      this.handleUpdate({relative, start, end, utc});
    } else {
      this.setState({isOpen: false, inputValue: ''});
    }
  };

  handleUpdate = (datetime: ChangeData) => {
    const {onUpdate} = this.props;

    this.setState(
      {
        isOpen: false,
        inputValue: '',
        hasChanges: false,
      },
      () => {
        this.callCallback(onUpdate, datetime);
      }
    );
  };

  handleSelect = (item: Item) => {
    if (item.value === 'absolute') {
      this.handleAbsoluteClick();
      return;
    }
    this.handleSelectRelative(item.value);
  };

  handleAbsoluteClick = () => {
    const {relative, onChange, defaultPeriod, defaultAbsolute, start, end} = this.props;

    // If we already have a start/end we don't have to set a default
    if (start && end) {
      return;
    }

    // Set default range to equivalent of last relative period,
    // or use default stats period
    const newDateTime: ChangeData = {
      relative: null,
      start: defaultAbsolute?.start
        ? defaultAbsolute.start
        : getPeriodAgo(
            'hours',
            parsePeriodToHours(relative || defaultPeriod || DEFAULT_STATS_PERIOD)
          ).toDate(),
      end: defaultAbsolute?.end ? defaultAbsolute.end : new Date(),
    };

    if (defined(this.props.utc)) {
      newDateTime.utc = this.state.utc;
    }

    this.setState({
      hasChanges: true,
      ...newDateTime,
      start: newDateTime.start,
      end: newDateTime.end,
    });
    this.callCallback(onChange, newDateTime);
  };

  handleSelectRelative = (value: string) => {
    const {onChange} = this.props;
    const newDateTime: ChangeData = {
      relative: value,
      start: undefined,
      end: undefined,
    };
    this.setState(newDateTime);
    this.callCallback(onChange, newDateTime);
    this.handleUpdate(newDateTime);
  };

  handleClear = () => {
    const {onChange, defaultPeriod} = this.props;

    const newDateTime: ChangeData = {
      relative: defaultPeriod || DEFAULT_STATS_PERIOD,
      start: undefined,
      end: undefined,
      utc: null,
    };
    this.setState(newDateTime);
    this.callCallback(onChange, newDateTime);
    this.handleUpdate(newDateTime);
  };

  handleSelectDateRange = ({
    start,
    end,
    hasDateRangeErrors = false,
  }: DateRangeChangeData) => {
    if (hasDateRangeErrors) {
      this.setState({hasDateRangeErrors});
      return;
    }

    const {onChange} = this.props;

    const newDateTime: ChangeData = {
      relative: null,
      start,
      end,
    };

    if (defined(this.props.utc)) {
      newDateTime.utc = this.state.utc;
    }

    this.setState({hasChanges: true, hasDateRangeErrors, ...newDateTime});
    this.callCallback(onChange, newDateTime);
  };

  handleUseUtc = () => {
    const {onChange, router} = this.props;
    let {start, end} = this.props;

    this.setState(state => {
      const utc = !state.utc;

      if (!start) {
        start = getDateWithTimezoneInUtc(state.start, state.utc);
      }

      if (!end) {
        end = getDateWithTimezoneInUtc(state.end, state.utc);
      }

      analytics('dateselector.utc_changed', {
        utc,
        path: getRouteStringFromRoutes(router.routes),
        org_id: parseInt(this.props.organization.id, 10),
      });

      const newDateTime = {
        relative: null,
        start: utc ? getLocalToSystem(start) : getUtcToSystem(start),
        end: utc ? getLocalToSystem(end) : getUtcToSystem(end),
        utc,
      };
      this.callCallback(onChange, newDateTime);

      return {
        hasChanges: true,
        ...newDateTime,
      };
    });
  };

  handleOpen = () => {
    if (this.props.disabled) {
      return;
    }
    this.setState({isOpen: true});
    // Start loading react-date-picker
    import('../timeRangeSelector/dateRange/index');
  };

  onInputValueChange = inputValue => {
    this.setState({inputValue});
  };

  autoCompleteFilter: typeof autoCompleteFilter = (...args) => {
    if (this.props.disallowArbitraryRelativeRanges) {
      return autoCompleteFilter(...args);
    }

    return timeRangeAutoCompleteFilter(...args, {
      maxDays: this.props.maxPickableDays,
    });
  };

  render() {
    const {
      defaultPeriod,
      showAbsolute,
      showRelative,
      organization,
      hint,
      label,
      relativeOptions,
      maxPickableDays,
      customDropdownButton,
      detached,
      disabled,
      alignDropdown,
      showPin,
    } = this.props;
    const {start, end, relative} = this.state;

    const shouldShowAbsolute = showAbsolute;
    const shouldShowRelative = showRelative;
    const isAbsoluteSelected = !!start && !!end;

    const summary =
      isAbsoluteSelected && start && end ? (
        <DateSummary start={start} end={end} />
      ) : (
        getRelativeSummary(
          relative || defaultPeriod || DEFAULT_STATS_PERIOD,
          relativeOptions
        )
      );

    return (
      <SelectorItemsHook
        shouldShowAbsolute={shouldShowAbsolute}
        shouldShowRelative={shouldShowRelative}
        relativePeriods={relativeOptions}
        handleSelectRelative={this.handleSelectRelative}
      >
        {items => (
          <ClassNames>
            {({css}) => (
              <StyledDropdownAutoComplete
                allowActorToggle
                autoCompleteFilter={this.autoCompleteFilter}
                alignMenu={alignDropdown ?? (isAbsoluteSelected ? 'right' : 'left')}
                isOpen={this.state.isOpen}
                inputValue={this.state.inputValue}
                onInputValueChange={this.onInputValueChange}
                onOpen={this.handleOpen}
                onClose={this.handleCloseMenu}
                hideInput={!shouldShowRelative}
                closeOnSelect={false}
                blendCorner={false}
                maxHeight={400}
                detached={detached}
                disabled={disabled}
                items={items}
                searchPlaceholder={t('Provide a time range')}
                rootClassName={css`
                  position: relative;
                  display: flex;
                  height: 100%;
                `}
                inputActions={
                  showPin ? (
                    <StyledPinButton
                      organization={organization}
                      filter="datetime"
                      size="xs"
                    />
                  ) : undefined
                }
                onSelect={this.handleSelect}
                subPanel={
                  isAbsoluteSelected && (
                    <AbsoluteRangeWrap>
                      <DateRangeHook
                        start={start ?? null}
                        end={end ?? null}
                        organization={organization}
                        showTimePicker
                        utc={this.state.utc}
                        onChange={this.handleSelectDateRange}
                        onChangeUtc={this.handleUseUtc}
                        maxPickableDays={maxPickableDays}
                      />
                      <SubmitRow>
                        <MultipleSelectorSubmitRow
                          onSubmit={this.handleCloseMenu}
                          disabled={
                            !this.state.hasChanges || this.state.hasDateRangeErrors
                          }
                        />
                      </SubmitRow>
                    </AbsoluteRangeWrap>
                  )
                }
              >
                {({isOpen, getActorProps}) =>
                  customDropdownButton ? (
                    customDropdownButton({getActorProps, isOpen})
                  ) : (
                    <StyledHeaderItem
                      data-test-id="page-filter-timerange-selector"
                      icon={label ?? <IconCalendar />}
                      isOpen={isOpen}
                      hasSelected={
                        (!!this.props.relative &&
                          this.props.relative !== defaultPeriod) ||
                        isAbsoluteSelected
                      }
                      hasChanges={this.state.hasChanges}
                      onClear={this.handleClear}
                      allowClear
                      hint={hint}
                      {...getActorProps()}
                    >
                      {getDynamicText({
                        value: summary,
                        fixed: 'start to end',
                      })}
                    </StyledHeaderItem>
                  )
                }
              </StyledDropdownAutoComplete>
            )}
          </ClassNames>
        )}
      </SelectorItemsHook>
    );
  }
}

const TimeRangeRoot = styled('div')`
  position: relative;
`;

const StyledDropdownAutoComplete = styled(DropdownAutoComplete)`
  font-size: ${p => p.theme.fontSizeMedium};
  position: absolute;
  top: 100%;

  ${p =>
    !p.detached &&
    `
    margin-top: 0;
    border-radius: ${p.theme.borderRadiusBottom};
  `};
`;

const StyledHeaderItem = styled(HeaderItem)`
  height: 100%;
`;

const AbsoluteRangeWrap = styled('div')`
  display: flex;
  flex-direction: column;
`;

const SubmitRow = styled('div')`
  height: 100%;
  padding: ${space(0.5)} ${space(1)};
  border-top: 1px solid ${p => p.theme.innerBorder};
  border-left: 1px solid ${p => p.theme.border};
`;

const StyledPinButton = styled(PageFilterPinButton)`
  margin: 0 ${space(1)};
`;

export default withRouter(TimeRangeSelector);

export {TimeRangeRoot};
