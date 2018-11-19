import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {
  DEFAULT_RELATIVE_PERIODS,
  DEFAULT_STATS_PERIOD,
  DEFAULT_USE_UTC,
} from 'app/constants';
import {analytics} from 'app/utils/analytics';
import {getLocalToUtc, getPeriodAgo, getUtcInLocal} from 'app/utils/dates';
import {parsePeriodToHours} from 'app/utils';
import {t} from 'app/locale';
import DateRange from 'app/components/organizations/timeRangeSelector/dateRange';
import DateSummary from 'app/components/organizations/timeRangeSelector/dateSummary';
import DropdownMenu from 'app/components/dropdownMenu';
import HeaderItem from 'app/components/organizations/headerItem';
import InlineSvg from 'app/components/inlineSvg';
import RelativeSelector from 'app/components/organizations/timeRangeSelector/dateRange/relativeSelector';
import SelectorItem from 'app/components/organizations/timeRangeSelector/dateRange/selectorItem';
import getDynamicText from 'app/utils/getDynamicText';

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
  };

  static defaultProps = {
    showAbsolute: true,
    showRelative: false,
    utc: DEFAULT_USE_UTC,
  };

  constructor(props) {
    super(props);
    this.state = {
      utc: props.utc,
      isOpen: false,
    };
  }

  getSelectedStateFromProps = props => {
    const {start, end, relative} = props || this.props;
    return !!start && !!end ? 'absolute' : relative;
  };

  handleCloseMenu = () => {
    this.handleUpdate();
  };

  handleUpdate = () => {
    const {onUpdate} = this.props;

    this.setState(
      {
        isOpen: false,
      },
      () => {
        if (typeof onUpdate === 'function') {
          onUpdate();
        }
      }
    );
  };

  handleAbsoluteClick = () => {
    const {relative, onChange} = this.props;

    // Set default range to equivalent of last relative period,
    // or use default stats period
    onChange({
      relative: null,
      start: getPeriodAgo(
        parsePeriodToHours(relative || DEFAULT_STATS_PERIOD),
        'hours'
      ).toDate(),
      end: new Date(),
      utc: this.state.utc,
    });
  };

  handleSelectRelative = value => {
    const {onChange} = this.props;
    onChange({
      relative: value,
      start: null,
      end: null,
      utc: this.state.utc,
    });
    this.handleUpdate();
  };

  handleSelectDateRange = ({start, end}) => {
    const {onChange} = this.props;

    onChange({
      relative: null,
      start,
      end,
      utc: this.state.utc,
    });
  };

  handleUseUtc = () => {
    const {onChange, start, end} = this.props;

    this.setState(state => {
      const utc = !state.utc;
      analytics('dateselector.utc_changed', {
        utc,
      });

      onChange({
        relative: null,
        start: utc ? getLocalToUtc(start) : getUtcInLocal(start),
        end: utc ? getLocalToUtc(end) : getUtcInLocal(end),
        utc,
      });

      return {
        utc,
      };
    });
  };

  render() {
    const {start, end, relative, showAbsolute, showRelative} = this.props;

    const shouldShowAbsolute = showAbsolute;
    const shouldShowRelative = showRelative;
    const isAbsoluteSelected = !!start && !!end;

    const summary = relative ? (
      `${DEFAULT_RELATIVE_PERIODS[relative]}`
    ) : (
      <DateSummary utc={this.state.utc} start={start} end={end} />
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
              hasSelected={true}
              allowClear={false}
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
                      selected={relative}
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
