
/** @jsx React.DOM */
var DateTimePickerDate, DateTimePickerDays, DateTimePickerMonths, DateTimePickerYears, React;

React = require('react');

DateTimePickerDays = require('./DateTimePickerDays');

DateTimePickerMonths = require('./DateTimePickerMonths');

DateTimePickerYears = require('./DateTimePickerYears');

DateTimePickerDate = React.createClass({
  propTypes: {
    subtractMonth: React.PropTypes.func.isRequired,
    addMonth: React.PropTypes.func.isRequired,
    viewDate: React.PropTypes.object.isRequired,
    selectedDate: React.PropTypes.object.isRequired,
    showToday: React.PropTypes.bool,
    daysOfWeekDisabled: React.PropTypes.array,
    setSelectedDate: React.PropTypes.func.isRequired,
    subtractYear: React.PropTypes.func.isRequired,
    addYear: React.PropTypes.func.isRequired,
    setViewMonth: React.PropTypes.func.isRequired,
    setViewYear: React.PropTypes.func.isRequired,
    addDecade: React.PropTypes.func.isRequired,
    subtractDecade: React.PropTypes.func.isRequired
  },
  getInitialState: function() {
    return {
      daysDisplayed: true,
      monthsDisplayed: false,
      yearsDisplayed: false
    };
  },
  showMonths: function() {
    return this.setState({
      daysDisplayed: false,
      monthsDisplayed: true
    });
  },
  showYears: function() {
    return this.setState({
      monthsDisplayed: false,
      yearsDisplayed: true
    });
  },
  setViewYear: function(e) {
    this.props.setViewYear(e.target.innerHTML);
    return this.setState({
      yearsDisplayed: false,
      monthsDisplayed: true
    });
  },
  setViewMonth: function(e) {
    this.props.setViewMonth(e.target.innerHTML);
    return this.setState({
      monthsDisplayed: false,
      daysDisplayed: true
    });
  },
  renderDays: function() {
    if (this.state.daysDisplayed) {
      return (
      <DateTimePickerDays
            addMonth={this.props.addMonth}
            subtractMonth={this.props.subtractMonth}
            setSelectedDate={this.props.setSelectedDate}
            viewDate={this.props.viewDate}
            selectedDate={this.props.selectedDate}
            showToday={this.props.showToday}
            daysOfWeekDisabled={this.props.daysOfWeekDisabled}
            showMonths={this.showMonths}
      />
      );
    } else {
      return null;
    }
  },
  renderMonths: function() {
    if (this.state.monthsDisplayed) {
      return (
      <DateTimePickerMonths
            subtractYear={this.props.subtractYear}
            addYear={this.props.addYear}
            viewDate={this.props.viewDate}
            selectedDate={this.props.selectedDate}
            showYears={this.showYears}
            setViewMonth={this.setViewMonth}
      />
      );
    } else {
      return null;
    }
  },
  renderYears: function() {
    if (this.state.yearsDisplayed) {
      return (
      <DateTimePickerYears
            viewDate={this.props.viewDate}
            selectedDate={this.props.selectedDate}
            setViewYear={this.setViewYear}
            addDecade={this.props.addDecade}
            subtractDecade={this.props.subtractDecade}
      />
      );
    } else {
      return null;
    }
  },
  render: function() {
    return (
    <div className="datepicker">
      {this.renderDays()}

      {this.renderMonths()}

      {this.renderYears()}
    </div>
    );
  }
});

module.exports = DateTimePickerDate;
