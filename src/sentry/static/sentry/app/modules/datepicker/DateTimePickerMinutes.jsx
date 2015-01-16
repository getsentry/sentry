
/** @jsx React.DOM */
var DateTimePickerMinutes, React;

React = require('react');

DateTimePickerMinutes = React.createClass({
  propTypes: {
    setSelectedMinute: React.PropTypes.func.isRequired
  },
  render: function() {
    return (
      <div className="timepicker-minutes" data-action="selectMinute" style={{display: 'block'}}>
        <table className="table-condensed">
          <tbody>
            <tr>
              <td className="minute" onClick={this.props.setSelectedMinute}>00</td>

              <td className="minute" onClick={this.props.setSelectedMinute}>05</td>

              <td className="minute" onClick={this.props.setSelectedMinute}>10</td>

              <td className="minute" onClick={this.props.setSelectedMinute}>15</td>
            </tr>

            <tr>
              <td className="minute" onClick={this.props.setSelectedMinute}>20</td>

              <td className="minute" onClick={this.props.setSelectedMinute}>25</td>

              <td className="minute" onClick={this.props.setSelectedMinute}>30</td>

              <td className="minute" onClick={this.props.setSelectedMinute}>35</td>
            </tr>

            <tr>
              <td className="minute" onClick={this.props.setSelectedMinute}>40</td>

              <td className="minute" onClick={this.props.setSelectedMinute}>45</td>

              <td className="minute" onClick={this.props.setSelectedMinute}>50</td>

              <td className="minute" onClick={this.props.setSelectedMinute}>55</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
});

module.exports = DateTimePickerMinutes;
