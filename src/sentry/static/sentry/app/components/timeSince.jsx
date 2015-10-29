import React from "react";
import moment from "moment";
import PureRenderMixin from 'react-addons-pure-render-mixin';

const TimeSince = React.createClass({
  propTypes: {
    date: React.PropTypes.any.isRequired,
    suffix: React.PropTypes.string
  },

  mixins: [
    PureRenderMixin
  ],

  statics: {
    getDateObj(date) {
      if (typeof date === "string" || typeof date === "number") {
        date = new Date(date);
      }
      return date;
    }
  },

  getDefaultProps() {
    return {
      suffix: 'ago'
    };
  },

  getInitialState() {
    return {
      relative: this.getRelativeDate()
    };
  },

  componentDidMount() {
    this.setRelativeDateTicker();
  },

  componentWillUnmount() {
    if (this.ticker) {
      clearTimeout(this.ticker);
      this.ticker = null;
    }
  },

  setRelativeDateTicker() {
    const ONE_MINUTE_IN_MS = 3600;

    this.ticker = setTimeout(() => {
      this.setState({
        relative: this.getRelativeDate()
      });
      this.setRelativeDateTicker();
    }, ONE_MINUTE_IN_MS);
  },

  getRelativeDate() {
    let date = TimeSince.getDateObj(this.props.date);
    return moment(date).fromNow(true);
  },

  render() {
    let date = TimeSince.getDateObj(this.props.date);

    return (
      <time
        dateTime={date.toISOString()}
        title={date.toString()}>{this.state.relative} {this.props.suffix || ''}</time>
    );
  }
});

export default TimeSince;

