import React from "react";
import moment from "moment";
import PureRenderMixin from 'react-addons-pure-render-mixin';
import ConfigStore from '../stores/configStore.jsx';

var TimeSince = React.createClass({
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
    let user = ConfigStore.get('user');
    let options = user ? user.options : {};
    let format = options.clock24Hours ? 'MMMM D YYYY HH:mm:ss z' : 'LLL z';

    return (
      <time
        dateTime={date.toISOString()}
        title={moment(date).format(format)}>{this.state.relative} {this.props.suffix || ''}</time>
    );
  }
});

export default TimeSince;

