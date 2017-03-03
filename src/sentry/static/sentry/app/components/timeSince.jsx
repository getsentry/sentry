import React from 'react';
import moment from 'moment';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import ConfigStore from '../stores/configStore.jsx';
import {t} from '../locale';
import _ from 'underscore';

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
      if (_.isString(date) || _.isNumber(date)) {
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
    const ONE_MINUTE_IN_MS = 60000;

    this.ticker = setTimeout(() => {
      this.setState({
        relative: this.getRelativeDate()
      });
      this.setRelativeDateTicker();
    }, ONE_MINUTE_IN_MS);
  },

  getRelativeDate() {
    let date = TimeSince.getDateObj(this.props.date);
    if (!this.props.suffix) {
      return moment(date).fromNow(true);
    } else if (this.props.suffix === 'ago') {
      return moment(date).fromNow();
    } else if (this.props.suffix == 'old') {
      return t('%(time)s old', {time: moment(date).fromNow(true)});
    } else {
      throw new Error('Unsupported time format suffix');
    }
  },

  render() {
    let date = TimeSince.getDateObj(this.props.date);
    let user = ConfigStore.get('user');
    let options = user ? user.options : {};
    let format = options.clock24Hours ? 'MMMM D YYYY HH:mm:ss z' : 'LLL z';

    return (
      <time
        dateTime={date.toISOString()}
        title={moment(date).format(format)}
        className={this.props.className} >{this.state.relative}</time>
    );
  }
});

export default TimeSince;

