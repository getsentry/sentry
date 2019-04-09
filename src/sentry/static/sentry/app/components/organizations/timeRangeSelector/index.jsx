import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';
import styled from 'react-emotion';

import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {analytics} from 'app/utils/analytics';
import {defined, parsePeriodToHours} from 'app/utils';
import {
  getLocalToSystem,
  getPeriodAgo,
  getUserTimezone,
  getUtcToSystem,
} from 'app/utils/dates';
import {getRelativeSummary} from 'app/components/organizations/timeRangeSelector/utils';
import {t} from 'app/locale';
import DateRange from 'app/components/organizations/timeRangeSelector/dateRange';
import DateSummary from 'app/components/organizations/timeRangeSelector/dateSummary';
import DropdownMenu from 'app/components/dropdownMenu';
import HeaderItem from 'app/components/organizations/headerItem';
import InlineSvg from 'app/components/inlineSvg';
import RelativeSelector from 'app/components/organizations/timeRangeSelector/dateRange/relativeSelector';
import SelectorItem from 'app/components/organizations/timeRangeSelector/dateRange/selectorItem';
import SentryTypes from 'app/sentryTypes';
import getDynamicText from 'app/utils/getDynamicText';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';

// Strips timezone from local date, creates a new moment date object with timezone
// Then returns as a Date object
const getDateWithTimezoneInUtc = (date, utc) =>
  moment
    .tz(
      moment(date)
        .local()
        .format('YYYY-MM-DD HH:mm:ss'),
      utc ? 'UTC' : getUserTimezone()
    )
    .utc()
    .toDate();

const getInternalDate = (date, utc) => {
  if (utc) {
    return getUtcToSystem(date);
  } else {
    return new Date(
      moment.tz(moment.utc(date), getUserTimezone()).format('YYYY-MM-DD HH:mm:ss')
    );
  }
};

class TimeRangeSelector extends React.PureComponent {
  static propTypes = {
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
  };

  static defaultProps = {
    showAbsolute: true,
    showRelative: true,
  };

  static contextTypes = {
    router: PropTypes.object,
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

  handleSelectDateRange = ({start, end}) => {
    const {onChange} = this.props;

    const newDateTime = {
      relative: null,
      start,
      end,
    };

    if (defined(this.props.utc)) {
      newDateTime.utc = this.state.utc;
    }

    this.setState({hasChanges: true, ...newDateTime});
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
    const {showAbsolute, showRelative, organization} = this.props;
    const {start, end, relative} = this.state;

    const shouldShowAbsolute = showAbsolute;
    const shouldShowRelative = showRelative;
    const isAbsoluteSelected = !!start && !!end;

    const summary = isAbsoluteSelected ? (
      <DateSummary utc={this.state.utc} start={start} end={end} />
    ) : (
      getRelativeSummary(relative || DEFAULT_STATS_PERIOD)
    );

    return (
      <DropdownMenu
        isOpen={this.state.isOpen}
        onOpen={() => this.setState({isOpen: true})}
        onClose={this.handleCloseMenu}
        keepMenuOpen={true}
      >
        {({isOpen, getRootProps, getActorProps, getMenuProps}) => (
          <TimeRangeRoot {...getRootProps()}>
            <StyledHeaderItem
              icon={<StyledInlineSvg src="icon-calendar" />}
              isOpen={isOpen}
              hasSelected={
                (!!this.props.relative && this.props.relative !== DEFAULT_STATS_PERIOD) ||
                isAbsoluteSelected
              }
              hasChanges={this.state.hasChanges}
              onClear={this.handleClear}
              allowClear={true}
              onSubmit={this.handleCloseMenu}
              {...getActorProps({isStyled: true})}
            >
              {getDynamicText({value: summary, fixed: 'start to end'})}
            </StyledHeaderItem>

            {isOpen && (
              <Menu
                {...getMenuProps({isStyled: true})}
                isAbsoluteSelected={isAbsoluteSelected}
              >
                <SelectorList isAbsoluteSelected={isAbsoluteSelected}>
                  {shouldShowRelative && (
                    <RelativeSelector
                      onClick={this.handleSelectRelative}
                      selected={relative || DEFAULT_STATS_PERIOD}
                    />
                  )}
                  {shouldShowAbsolute && (
                    <SelectorItem
                      onClick={this.handleAbsoluteClick}
                      value="absolute"
                      label={t('Absolute Date')}
                      selected={isAbsoluteSelected}
                      last={true}
                    />
                  )}
                </SelectorList>
                {isAbsoluteSelected && (
                  <DateRange
                    showTimePicker
                    utc={this.state.utc}
                    start={start}
                    end={end}
                    onChange={this.handleSelectDateRange}
                    onChangeUtc={this.handleUseUtc}
                    organization={organization}
                  />
                )}
              </Menu>
            )}
          </TimeRangeRoot>
        )}
      </DropdownMenu>
    );
  }
}

const TimeRangeRoot = styled.div`
  position: relative;
`;

const StyledHeaderItem = styled(HeaderItem)`
  height: 100%;
`;

const StyledInlineSvg = styled(InlineSvg)`
  transform: translateY(-2px);
  height: 17px;
  width: 17px;
`;

const Menu = styled('div')`
  ${p => !p.isAbsoluteSelected && 'left: -1px'};
  ${p => p.isAbsoluteSelected && 'right: -1px'};

  display: flex;
  background: #fff;
  border: 1px solid ${p => p.theme.borderLight};
  position: absolute;
  top: 100%;
  min-width: 120%;
  z-index: ${p => p.theme.zIndex.dropdown};
  box-shadow: ${p => p.theme.dropShadowLight};
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  font-size: 0.8em;
`;

const SelectorList = styled(({isAbsoluteSelected, ...props}) => <Flex {...props} />)`
  flex: 1;
  flex-direction: column;
  flex-shrink: 0;
  width: ${p => (p.isAbsoluteSelected ? '160px' : '220px')};
  min-height: 305px;
`;

export default TimeRangeSelector;

export {TimeRangeRoot};
