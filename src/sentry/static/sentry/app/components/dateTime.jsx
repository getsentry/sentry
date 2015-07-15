var React = require("react");
var moment = require("moment");

var DateTime = React.createClass({
  propTypes: {
    date: React.PropTypes.any.isRequired
  },

  render() {
    var date = this.props.date;

    if (typeof date === "string" || typeof date === "number") {
      date = new Date(date);
    }

    return (
      <time>{moment.utc(date).local().format('LLL z')}</time>
    );
  }
});

module.exports = DateTime;
