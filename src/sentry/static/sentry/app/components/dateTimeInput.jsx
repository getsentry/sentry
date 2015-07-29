var React = require("react");
var moment = require("moment");
var DatePicker = require("react-datepicker");

var DateTimeInput = React.createClass({
  getInitialState() {
    return {
      dateValue: moment(),
      timeValue: ''
    };
  },

  render() {
    var {dateValue, timeValue, month} = this.state;

    var selectedDay = moment(dateValue, "L", true).toDate();

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

module.exports = DateTimeInput;
