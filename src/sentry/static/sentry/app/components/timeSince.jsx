/*** @jsx React.DOM */
var React = require("react");
var moment = require("moment");

var TimeSince = React.createClass({
  propTypes: {
    date: React.PropTypes.any.isRequired
  },

  componentDidMount() {
    var delay = 2600;

    this.ticker = setInterval(this.ensureValidity, delay);
  },

  componentWillUnmount() {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  },

  ensureValidity() {
    // TODO(dcramer): this should ensure we actually *need* to update the value
    this.forceUpdate();
  },

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.date !== nextProps.date;
  },

  render() {
    var date = this.props.date;

    if (typeof date === "string" || typeof date === "number") {
      date = new Date(date);
    }

    return (
      <time>{moment.utc(date).fromNow()}</time>
    );
  }
});

module.exports = TimeSince;
