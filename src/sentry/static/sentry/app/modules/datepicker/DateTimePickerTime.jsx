
/** @jsx React.DOM */
var DateTimePickerHours, DateTimePickerMinutes, DateTimePickerTime, Glyphicon, React;

React = require('react');

DateTimePickerMinutes = require('./DateTimePickerMinutes');

DateTimePickerHours = require('./DateTimePickerHours');

Glyphicon = require('react-bootstrap/Glyphicon');

DateTimePickerTime = React.createClass({
  propTypes: {
    setSelectedHour: React.PropTypes.func.isRequired,
    setSelectedMinute: React.PropTypes.func.isRequired,
    subtractHour: React.PropTypes.func.isRequired,
    addHour: React.PropTypes.func.isRequired,
    subtractMinute: React.PropTypes.func.isRequired,
    addMinute: React.PropTypes.func.isRequired,
    viewDate: React.PropTypes.object.isRequired,
    selectedDate: React.PropTypes.object.isRequired,
    togglePeriod: React.PropTypes.func.isRequired
  },
  getInitialState: function() {
    return {
      minutesDisplayed: false,
      hoursDisplayed: false
    };
  },
  showMinutes: function() {
    return this.setState({
      minutesDisplayed: true
    });
  },
  showHours: function() {
    return this.setState({
      hoursDisplayed: true
    });
  },
  renderMinutes: function() {
    if (this.state.minutesDisplayed) {
      return (<DateTimePickerMinutes
            setSelectedMinute={this.props.setSelectedMinute}
       />
       );
    } else {
      return null;
    }
  },
  renderHours: function() {
    if (this.state.hoursDisplayed) {
      return (<DateTimePickerHours
            setSelectedHour={this.props.setSelectedHour}
      />
      );
    } else {
      return null;
    }
  },
  renderPicker: function() {
    if (!this.state.minutesDisplayed && !this.state.hoursDisplayed) {
      return (
      <div className="timepicker-picker">
        <table className="table-condensed">
          <tbody>
            <tr>
              <td><a className="btn" onClick={this.props.addHour}><Glyphicon glyph="chevron-up" /></a></td>

              <td className="separator"></td>

              <td><a className="btn" onClick={this.props.addMinute}><Glyphicon glyph="chevron-up" /></a></td>

              <td className="separator"></td>
            </tr>

            <tr>
              <td><span className="timepicker-hour" onClick={this.showHours}>{this.props.selectedDate.format('h')}</span></td>

              <td className="separator">:</td>

              <td><span className="timepicker-minute" onClick={this.showMinutes}>{this.props.selectedDate.format('mm')}</span></td>

              <td className="separator"></td>

              <td><button className="btn btn-primary" onClick={this.props.togglePeriod} type="button">{this.props.selectedDate.format('A')}</button></td>
            </tr>

            <tr>
              <td><a className="btn" onClick={this.props.subtractHour}><Glyphicon glyph="chevron-down" /></a></td>

              <td className="separator"></td>

              <td><a className="btn" onClick={this.props.subtractMinute}><Glyphicon glyph="chevron-down" /></a></td>

              <td className="separator"></td>
            </tr>
          </tbody>
        </table>
      </div>
      );
    } else {
      return '';
    }
  },
  render: function() {
    return (
        <div className="timepicker">
          {this.renderPicker()}

          {this.renderHours()}

          {this.renderMinutes()}
        </div>
    );
  }
});

module.exports = DateTimePickerTime;
