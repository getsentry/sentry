import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment-timezone';
import styled from '@emotion/styled';

import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {analytics} from 'app/utils/analytics';
import {defined} from 'app/utils';
import {
  getLocalToSystem,
  getPeriodAgo,
  getUserTimezone,
  getUtcToSystem,
  parsePeriodToHours,
} from 'app/utils/dates';
import {getRelativeSummary} from 'app/components/organizations/timeRangeSelector/utils';
import DateRange from 'app/components/organizations/timeRangeSelector/dateRange';
import DateSummary from 'app/components/organizations/timeRangeSelector/dateSummary';
import DropdownMenu from 'app/components/dropdownMenu';
import HeaderItem from 'app/components/organizations/headerItem';
import HookOrDefault from 'app/components/hookOrDefault';
import MultipleSelectorSubmitRow from 'app/components/organizations/multipleSelectorSubmitRow';
import SelectorItems from 'app/components/organizations/timeRangeSelector/dateRange/selectorItems';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import getDynamicText from 'app/utils/getDynamicText';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';
import {IconCalendar} from 'app/icons';

// Strips timezone from local date, creates a new moment date object with timezone
// Then returns as a Date object
const getDateWithTimezoneInUtc = (date, utc) =>
  moment
    .tz(
      moment(date).local().format('YYYY-MM-DD HH:mm:ss'),
      utc ? 'UTC' : getUserTimezone()
    )
    .utc()
    .toDate();

const getInternalDate = (date, utc) => {
  if (utc) {
    return getUtcToSystem(date);
  } else {
    return new Date(
      moment.tz(moment.utc(date), getUserTimezone()).format('YYYY/MM/DD HH:mm:ss')
    );
  }
};

const DateRangeHook = HookOrDefault({
  hookName: 'component:header-date-range',
  defaultComponent: DateRange,
});

const SelectorItemsHook = HookOrDefault({
  hookName: 'component:header-selector-items',
  defaultComponent: SelectorItems,
});

class TimeRangeSelector extends React.PureComponent {
  static propTypes = {
    /**
     * When the default period is selected, it is visually dimmed and
     * makes the selector unclearable.
     */
    defaultPeriod: PropTypes.string,

    /**
     * Show absolute date selectors
     */
    showAbsolute: PropTypes.bool,
    /**
     * Show relative date selectors
     */
    showRelative: PropTypes.bool,

    /**
     * Start date value for absolute date selector
     * Accepts a JS Date or a moment object
     *
     * React does not support `instanceOf` with null values
     */
    start: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),

    /**
     * End date value for absolute date selector
     * Accepts a JS Date or a moment object
     *
     * React does not support `instanceOf` with null values
     */
    end: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),

    /**
     * Relative date value
     */
    relative: PropTypes.string,

    /**
     * Default initial value for using UTC
     */
    utc: PropTypes.bool,

    /**
     * Callback when value changes
     */
    onChange: PropTypes.func,

    /**
     * Callback when "Update" button is clicked
     */
    onUpdate: PropTypes.func,

    /**
     * Just used for metrics
     */
    organization: SentryTypes.Organization,

    /**
     * Small info icon with tooltip hint text
     */
    hint: PropTypes.string,
  };

  static contextTypes = {
    router: PropTypes.object,
  };

  static defaultProps = {
    showAbsolute: true,
    showRelative: true,
  };

  constructor(props) {
    super(props);

    let start;
    let end;

    if (props.start && props.end) {
      start = getInternalDate(props.start, props.utc);
      end = getInternalDate(props.end, props.utc);
    }

    this.state = {
      // if utc is not null and not undefined, then use value of `props.utc` (it can be false)
      // otherwise if no value is supplied, the default should be the user's timezone preference
      utc: defined(props.utc) ? props.utc : getUserTimezone() === 'UTC',
      isOpen: false,
      hasChanges: false,
      hasDateRangeErrors: false,
      start,
      end,
      relative: props.relative,
    };
  }

  callCallback = (callback, datetime) => {
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
      this.setState({isOpen: false});
    }
  };

  handleUpdate = datetime => {
    const {onUpdate} = this.props;

    this.setState(
      {
        isOpen: false,
        hasChanges: false,
      },
      () => {
        this.callCallback(onUpdate, datetime);
      }
    );
  };

  handleAbsoluteClick = () => {
    const {relative, onChange} = this.props;

    // Set default range to equivalent of last relative period,
    // or use default stats period
    const newDateTime = {
      relative: null,
      start: getPeriodAgo(
        parsePeriodToHours(relative || DEFAULT_STATS_PERIOD),
        'hours'
      ).toDate(),
      end: new Date(),
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

  handleSelectRelative = value => {
    const {onChange} = this.props;
    const newDateTime = {
      relative: value,
      start: null,
      end: null,
    };
    this.setState(newDateTime);
    this.callCallback(onChange, newDateTime);
    this.handleUpdate(newDateTime);
  };

  handleClear = () => {
    const {onChange} = this.props;

    const newDateTime = {
      relative: null,
      start: null,
      end: null,
      utc: null,
    };
    this.setState(newDateTime);
    this.callCallback(onChange, newDateTime);
    this.handleUpdate(newDateTime);
  };

  handleSelectDateRange = ({start, end, hasDateRangeErrors = false}) => {
    if (hasDateRangeErrors) {
      this.setState({hasDateRangeErrors});
      return;
    }

    const {onChange} = this.props;

    const newDateTime = {
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
    const {onChange} = this.props;
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
        path: getRouteStringFromRoutes(this.context.router.routes),
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

  render() {
    const {defaultPeriod, showAbsolute, showRelative, organization, hint} = this.props;
    const {start, end, relative} = this.state;

    const shouldShowAbsolute = showAbsolute;
    const shouldShowRelative = showRelative;
    const isAbsoluteSelected = !!start && !!end;

    const summary = isAbsoluteSelected ? (
      <DateSummary utc={this.state.utc} start={start} end={end} />
    ) : (
      getRelativeSummary(relative || defaultPeriod)
    );

    const relativeSelected = isAbsoluteSelected ? null : relative || defaultPeriod;

    return (
      <DropdownMenu
        isOpen={this.state.isOpen}
        onOpen={() => this.setState({isOpen: true})}
        onClose={this.handleCloseMenu}
        keepMenuOpen
      >
        {({isOpen, getRootProps, getActorProps, getMenuProps}) => (
          <TimeRangeRoot {...getRootProps()}>
            <StyledHeaderItem
              data-test-id="global-header-timerange-selector"
              icon={<IconCalendar />}
              isOpen={isOpen}
              hasSelected={
                (!!this.props.relative && this.props.relative !== defaultPeriod) ||
                isAbsoluteSelected
              }
              hasChanges={this.state.hasChanges}
              onClear={this.handleClear}
              allowClear
              hint={hint}
              {...getActorProps()}
            >
              {getDynamicText({value: summary, fixed: 'start to end'})}
            </StyledHeaderItem>

            {isOpen && (
              <Menu {...getMenuProps()} isAbsoluteSelected={isAbsoluteSelected}>
                <SelectorList isAbsoluteSelected={isAbsoluteSelected}>
                  <SelectorItemsHook
                    {...{
                      isAbsoluteSelected,
                      relativeSelected,
                      shouldShowRelative,
                      shouldShowAbsolute,
                    }}
                    handleAbsoluteClick={this.handleAbsoluteClick}
                    handleSelectRelative={this.handleSelectRelative}
                  />
                </SelectorList>
                {isAbsoluteSelected && (
                  <div>
                    <DateRangeHook
                      {...{
                        start,
                        end,
                        organization,
                      }}
                      showTimePicker
                      utc={this.state.utc}
                      onChange={this.handleSelectDateRange}
                      onChangeUtc={this.handleUseUtc}
                    />
                    <SubmitRow>
                      <MultipleSelectorSubmitRow
                        onSubmit={this.handleCloseMenu}
                        disabled={!this.state.hasChanges || this.state.hasDateRangeErrors}
                      />
                    </SubmitRow>
                  </div>
                )}
              </Menu>
            )}
          </TimeRangeRoot>
        )}
      </DropdownMenu>
    );
  }
}

const TimeRangeRoot = styled('div')`
  position: relative;
`;

const StyledHeaderItem = styled(HeaderItem)`
  height: 100%;
`;

const Menu = styled('div')`
  ${p => !p.isAbsoluteSelected && 'left: -1px'};
  ${p => p.isAbsoluteSelected && 'right: -1px'};

  display: flex;
  background: #fff;
  border: 1px solid ${p => p.theme.border};
  position: absolute;
  top: 100%;
  min-width: 100%;
  z-index: ${p => p.theme.zIndex.dropdown};
  box-shadow: ${p => p.theme.dropShadowLight};
  border-radius: ${p => p.theme.borderRadiusBottom};
  font-size: 0.8em;
  overflow: hidden;
`;

const SelectorList = styled('div')`
  display: flex;
  flex: 1;
  flex-direction: column;
  flex-shrink: 0;
  width: ${p => (p.isAbsoluteSelected ? '160px' : '220px')};
  min-height: 305px;
`;

const SubmitRow = styled('div')`
  padding: ${space(0.5)} ${space(1)};
  border-top: 1px solid ${p => p.theme.border};
  border-left: 1px solid ${p => p.theme.border};
`;

export default TimeRangeSelector;

export {TimeRangeRoot};
