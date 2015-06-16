
var DateTimePickerDays, React, moment;

React = require('react');

moment = require('moment');

DateTimePickerDays = React.createClass({
  propTypes: {
    subtractMonth: React.PropTypes.func.isRequired,
    addMonth: React.PropTypes.func.isRequired,
    viewDate: React.PropTypes.object.isRequired,
    selectedDate: React.PropTypes.object.isRequired,
    showToday: React.PropTypes.bool,
    daysOfWeekDisabled: React.PropTypes.array,
    setSelectedDate: React.PropTypes.func.isRequired,
    showMonths: React.PropTypes.func.isRequired
  },
  getDefaultProps: function() {
    return {
      showToday: true
    };
  },
  renderDays: function() {
    var cells, classes, days, html, i, month, nextMonth, prevMonth, row, year, _i, _len, _ref;
    year = this.props.viewDate.year();
    month = this.props.viewDate.month();
    prevMonth = this.props.viewDate.clone().subtract(1, "months");
    days = prevMonth.daysInMonth();
    prevMonth.date(days).startOf('week');
    nextMonth = moment(prevMonth).clone().add(42, "d");
    html = [];
    cells = [];
    while (prevMonth.isBefore(nextMonth)) {
      classes = {
        day: true
      };
      if (prevMonth.year() < year || (prevMonth.year() === year && prevMonth.month() < month)) {
        classes.old = true;
      } else if (prevMonth.year() > year || (prevMonth.year() === year && prevMonth.month() > month)) {
        classes.new = true;
      }
      if (prevMonth.isSame(moment({
        y: this.props.selectedDate.year(),
        M: this.props.selectedDate.month(),
        d: this.props.selectedDate.date()
      }))) {
        classes.active = true;
      }
      if (this.props.showToday) {
        if (prevMonth.isSame(moment(), 'day')) {
          classes.today = true;
        }
      }
      if (this.props.daysOfWeekDisabled) {
        _ref = this.props.daysOfWeekDisabled;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          i = _ref[_i];
          if (prevMonth.day() === this.props.daysOfWeekDisabled[i]) {
            classes.disabled = true;
            break;
          }
        }
      }
      cells.push(<td key={prevMonth.month() + '-' + prevMonth.date()} className={React.addons.classSet(classes)} onClick={this.props.setSelectedDate}>{prevMonth.date()}</td>);
      if (prevMonth.weekday() === moment().endOf('week').weekday()) {
        row = <tr key={prevMonth.month() + '-' + prevMonth.date()}>{cells}</tr>;
        html.push(row);
        cells = [];
      }
      prevMonth.add(1, "d");
    }
    return html;
  },
  render: function() {
    return (
    <div className="datepicker-days" style={{display: 'block'}}>
        <table className="table-condensed">
          <thead>
            <tr>
              <th className="prev" onClick={this.props.subtractMonth}>‹</th>

              <th className="switch" colSpan="5" onClick={this.props.showMonths}>{moment.months()[this.props.viewDate.month()]} {this.props.viewDate.year()}</th>

              <th className="next" onClick={this.props.addMonth}>›</th>
            </tr>

            <tr>
              <th className="dow">Su</th>

              <th className="dow">Mo</th>

              <th className="dow">Tu</th>

              <th className="dow">We</th>

              <th className="dow">Th</th>

              <th className="dow">Fr</th>

              <th className="dow">Sa</th>
            </tr>
          </thead>

          <tbody>
            {this.renderDays()}
          </tbody>
        </table>
      </div>
    );
  }
});

module.exports = DateTimePickerDays;
