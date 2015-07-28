var React = require("react");
var moment = require("moment");
var DayPicker = require("react-day-picker");
// var {isPastDay, isSameDay} = require("react-day-picker");

var DateTimeInput = React.createClass({
  getInitialState() {
    var today = new Date();
    return {
      // The value of the input field
      dateValue: moment(today).format("L"),
      timeValue: '',
      // The month to display in the calendar
      month: today
    };
  },

  render() {
    var {dateValue, timeValue, month} = this.state;

    var selectedDay = moment(dateValue, "L", true).toDate();
    var modifiers = {
      // Add the `disabled` modifier to days in the past. The day cell will have
      // a `DayPicker-Day--disabled` CSS class
      // "disabled": isPastDay,

      // Add the `selected` modifier to days corresponding to the day inserted
      // in the input field. The day cell will have a `DayPicker-Day--selected`
      // CSS class
      // "selected": (day) => isSameDay(selectedDay, day)
    };

    return (
      <div>
        <p>
          <input
            className="day form-control"
            ref="input"
            type="date"
            value={dateValue}
            placeholder="YYYY-MM-DD"
            onChange={this.handleDateInputChange}
            onFocus={this.showCurrentDate} />
          <input
            className="time form-control"
            ref="input"
            type="time"
            value={timeValue}
            placeholder="HH:MM"
            onChange={this.handleTimeInputChange} />
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
    var value = e.target.value;
    var month = this.state.month;

    // Change the current month only if the value entered by the user is a valid
    // date according to the `L` format
    if (moment(value, "L", true).isValid()) {
      month = moment(value, "L").toDate();
    }
    this.setState({
      value: dateValue,
      month: month
    }, this.showCurrentDate);
  },

  handleDayTouchTap(e, day, modifiers) {
    if (modifiers.indexOf("disabled") > -1) {
      return;
    }
    this.setState({
      dateValue: moment(day).format("L"),
      month: day
    });
  },

  showCurrentDate() {
    this.refs.daypicker.showMonth(this.state.month);
  }
});

module.exports = DateTimeInput;
