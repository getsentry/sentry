import React from "react";
import DatePicker from "react-datepicker";

var DateTimeInput = React.createClass({
  getInitialState() {
    var datetime = this.props.dateTime;
    if (!datetime) {
      return {
        dateValue: null,
        timeValue: ''
      };
    }

    return {
      dateValue: datetime,
      timeValue: datetime.format("HH:MM")
    };
  },

  render() {
    var {dateValue, timeValue} = this.state;

    return (
      <div>
        <p>
          <div className="datepicker-wrapper">
            <DatePicker
              selected={dateValue}
              onChange={this.handleDateChange}
              placeholderText="YYYY-MM-DD" />
          </div>
          <input
            className="time form-control"
            ref="input"
            type="time"
            value={timeValue}
            placeholder="HH:MM"
            onChange={this.handleTimeInputChange}
            onFocus={this.showDatePicker} />
        </p>
      </div>
    );
  },

  handleTimeInputChange(e) {
    this.setState({
      timeValue: e.target.value
    });
  },

  handleDateInputChange(e) {
    this.setState({
      dateValue: e.target.value,
    });
  }
});

export default DateTimeInput;
