import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';
import styled from 'react-emotion';

import {DEFAULT_RELATIVE_PERIODS} from 'app/constants';
import {getEndOfDay} from 'app/utils/dates';
import {t} from 'app/locale';
import DateRange from 'app/components/organizations/timeRangeSelector/dateRange';
import DateSummary from 'app/components/organizations/timeRangeSelector/dateSummary';
import DropdownMenu from 'app/components/dropdownMenu';
import HeaderItem from 'app/components/organizations/headerItem';
import InlineSvg from 'app/components/inlineSvg';
import RelativeSelector from 'app/components/organizations/timeRangeSelector/dateRange/relativeSelector';
import SelectorItem from 'app/components/organizations/timeRangeSelector/dateRange/selectorItem';
import getDynamicText from 'app/utils/getDynamicText';

// Get date 2 weeks ago at midnight
const getTwoWeeksAgo = () =>
  moment()
    .subtract(2, 'weeks')
    .hour(0)
    .minute(0)
    .toDate();

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
    start: PropTypes.object,

    /**
     * End date value for absolute date selector
     * Accepts a JS Date or a moment object
     *
     * React does not support `instanceOf` with null values
     */
    end: PropTypes.object,

    /**
     * Relative date value
     */
    relative: PropTypes.string,

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
  };

  constructor(props) {
    super(props);
    this.state = {
      useUtc: false,
      isOpen: false,
      selected: !!props.start && !!props.end ? 'absolute' : props.relative,
    };
  }

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
    // Don't allow toggle, its weird, they should select a different option
    this.setState(state => ({
      selected: 'absolute',
    }));
    this.props.onChange({
      relative: null,
      start: getTwoWeeksAgo(),
      end: getEndOfDay(),
    });
  };

  handleSelectRelative = value => {
    const {onChange} = this.props;
    onChange({
      relative: value,
      start: null,
      end: null,
    });
    this.setState({
      selected: value,
    });
    this.handleUpdate();
  };

  handleSelectDateRange = ({start, end}) => {
    const {onChange} = this.props;

    onChange({
      relative: null,
      start,
      end: moment(end)
        .add(1, 'day')
        .subtract(1, 'second')
        .toDate(),
    });
  };

  handleUseUtc = () => {
    this.setState(state => ({
      useUtc: !state.useUtc,
    }));
  };

  render() {
    const {start, end, relative, showAbsolute, showRelative} = this.props;

    const shouldShowAbsolute = showAbsolute;
    const shouldShowRelative = showRelative;
    const isAbsoluteSelected = this.state.selected === 'absolute';

    const summary = relative ? (
      `${DEFAULT_RELATIVE_PERIODS[relative]}`
    ) : (
      <DateSummary useUtc={this.state.useUtc} start={start} end={end} />
    );

    return (
      <DropdownMenu
        isOpen={this.state.isOpen}
        onOpen={() => this.setState({isOpen: true})}
        onClose={this.handleCloseMenu}
        keepMenuOpen={true}
      >
        {({isOpen, getRootProps, getActorProps, getMenuProps}) => (
          <div {...getRootProps()} style={{position: 'relative'}}>
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
                      selected={this.state.selected}
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
                    allowTimePicker
                    useUtc={this.state.useUtc}
                    start={moment(start)}
                    end={moment(end)}
                    onChange={this.handleSelectDateRange}
                    onChangeUtc={this.handleUseUtc}
                  />
                )}
              </Menu>
            )}
          </div>
        )}
      </DropdownMenu>
    );
  }
}

const StyledHeaderItem = styled(HeaderItem)`
  height: 100%;
  min-width: 230px;
  max-width: 360px;
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
