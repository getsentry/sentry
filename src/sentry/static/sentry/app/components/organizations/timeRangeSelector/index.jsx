import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';
import styled, {css} from 'react-emotion';

import {t} from 'app/locale';
import DateRangePicker from 'app/components/organizations/timeRangeSelector/dateRangePicker';
import DropdownLink from 'app/components/dropdownLink';
import DynamicWrapper from 'app/components/dynamicWrapper';
import HeaderItem from 'app/components/organizations/headerItem';
import space from 'app/styles/space';

const ALLOWED_RELATIVE_DATES = {
  '24h': t('Last 24 hours'),
  '7d': t('Last 7 days'),
  '14d': t('Last 14 days'),
  '30d': t('Last 30 days'),
};

const DropdownMenuCss = css`
  &.dropdown-menu {
    padding: 0;
  }
`;

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
     */
    start: PropTypes.string,
    /**
     * End date value for absolute date selector
     */
    end: PropTypes.string,

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
      isOpen: false,
      selected: !!props.start && !!props.end ? 'absolute' : props.relative,
    };
  }

  formatDate(date) {
    return moment
      .utc(date)
      .local()
      .format('MMMM D, h:mm a');
  }

  handleUpdate = () => {
    const {onUpdate} = this.props;
    this.setState({
      isOpen: false,
    });
    if (typeof onUpdate === 'function') {
      onUpdate();
    }
  };

  handleAbsoluteClick = () => {
    // Don't allow toggle, its weird, they should select a different option
    this.setState(state => ({
      selected: 'absolute',
    }));
  };

  handleSelectRelative = value => {
    const {onChange} = this.props;
    onChange({relative: value});
    this.setState({
      selected: value,
    });
    this.handleUpdate();
  };

  handleSelectDateRange = ({start, end}) => {
    const {onChange} = this.props;
    onChange({
      start: moment.utc(start).format(moment.HTML5_FMT.DATETIME_LOCAL_MS),
      end: moment.utc(end).format(moment.HTML5_FMT.DATETIME_LOCAL_MS),
    });
  };

  render() {
    const {className, start, end, relative, showAbsolute, showRelative} = this.props;

    const shouldShowAbsolute = showAbsolute;
    const shouldShowRelative = showRelative;
    const isAbsoluteSelected = this.state.selected === 'absolute';

    const summary = relative
      ? `${ALLOWED_RELATIVE_DATES[relative]}`
      : `${this.formatDate(start)} to ${this.formatDate(end)}`;

    return (
      <HeaderItem className={className} label={t('Time frame')}>
        <DropdownLink
          title={<DynamicWrapper value={<Title>{summary}</Title>} fixed="start to end" />}
          keepMenuOpen={true}
          isOpen={this.state.isOpen}
          onOpen={() => this.setState({isOpen: true})}
          onClose={this.handleUpdate}
          menuClasses={DropdownMenuCss}
        >
          <Flex>
            <RelativeSelectorList>
              {shouldShowRelative && (
                <RelativeSelector
                  choices={Object.entries(ALLOWED_RELATIVE_DATES)}
                  onClick={this.handleSelectRelative}
                  value={relative}
                  selected={this.state.selected}
                />
              )}
              {shouldShowAbsolute && (
                <SelectorItem
                  onClick={this.handleAbsoluteClick}
                  value="absolute"
                  label={t('Absolute Date')}
                  selected={isAbsoluteSelected}
                />
              )}
            </RelativeSelectorList>
            {isAbsoluteSelected && (
              <DateRangePicker
                start={start}
                end={end}
                onChange={this.handleSelectDateRange}
              />
            )}
          </Flex>
        </DropdownLink>
      </HeaderItem>
    );
  }
}

const SelectorItem = styled(
  class SelectorItem extends React.PureComponent {
    static propTypes = {
      onClick: PropTypes.func.isRequired,
      value: PropTypes.string,
      label: PropTypes.node,
      selected: PropTypes.bool,
    };

    handleClick = e => {
      let {onClick, value} = this.props;
      onClick(value, e);
    };
    render() {
      let {className, label, selected} = this.props;
      return (
        <Flex className={className} onClick={this.handleClick}>
          <Label>{label}</Label>

          {selected && <input style={{margin: 0}} type="checkbox" checked disabled />}
        </Flex>
      );
    }
  }
)`
  cursor: pointer;
  white-space: nowrap;
  padding: ${space(1)} ${space(2)};
  align-items: center;
  border-bottom: 1px solid ${p => p.theme.borderLight};
`;

const Label = styled('span')`
  flex: 1;
  margin-right: ${space(1)};
`;

const RelativeSelector = ({onClick, selected}) => {
  return (
    <React.Fragment>
      {Object.entries(ALLOWED_RELATIVE_DATES).map(([value, label]) => (
        <SelectorItem
          key={value}
          onClick={onClick}
          value={value}
          label={label}
          selected={selected === value}
        />
      ))}
    </React.Fragment>
  );
};
RelativeSelector.propTypes = {
  onClick: PropTypes.func,
  selected: PropTypes.string,
};

const RelativeSelectorList = styled(Flex)`
  flex: 1;
  flex-direction: column;
  flex-shrink: 0;
  width: 160px;
`;

const Title = styled.span`
  padding-right: 40px;
`;

export default TimeRangeSelector;
