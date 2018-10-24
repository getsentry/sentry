import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

import {DateRangePicker} from 'react-date-range';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {subDays} from 'date-fns';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

class DateRange extends React.Component {
  static propTypes = {
    /**
     * Start date value for absolute date selector
     */
    start: PropTypes.string,
    /**
     * End date value for absolute date selector
     */
    end: PropTypes.string,

    /**
     * Callback when value changes
     */
    onChange: PropTypes.func,
  };

  static defaultProps = {
    showAbsolute: true,
    showRelative: false,
  };

  constructor() {
    super();
    this.state = {};
  }

  handleSelectDateRange = ({selection}) => {
    const {onChange} = this.props;
    onChange({start: selection.startDate, end: selection.endDate});
  };

  render() {
    const {className, start, end} = this.props;

    return (
      <DateRangePicker
        className={className}
        rangeColors={[theme.purple]}
        ranges={[
          {
            startDate: start,
            endDate: end,
            key: 'selection',
          },
        ]}
        maxDate={new Date()}
        minDate={subDays(new Date(), 90)}
        onChange={this.handleSelectDateRange}
      />
    );
  }
}
const StyledDateRangePicker = styled(DateRange)`
  border-left: 1px solid ${p => p.theme.borderLight};
  .rdrMonthAndYearWrapper {
    padding-top: ${space(1)};
  }
  .rdrMonth {
    padding: 0 ${space(1)} ${space(1)} ${space(1)};
  }
  .rdrDefinedRangesWrapper {
    display: none;
  }
`;
export default StyledDateRangePicker;
