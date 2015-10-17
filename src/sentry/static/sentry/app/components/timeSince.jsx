import React from "react";
import moment from "moment";
import PureRenderMixin from 'react-addons-pure-render-mixin';

var TimeSince = React.createClass({
  mixins: [
    PureRenderMixin
  ],

  propTypes: {
    date: React.PropTypes.any.isRequired,
    suffix: React.PropTypes.string
  },

  getDefaultProps() {
    return {
      suffix: 'ago'
    };
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

  render() {
    var date = this.props.date;

    if (typeof date === "string" || typeof date === "number") {
      date = new Date(date);
    }

    return (
      <time
        dateTime={date.toISOString()}
        title={date.toString()}>{moment(date).fromNow(true)} {this.props.suffix || ''}</time>
    );
  }
});

export default TimeSince;

