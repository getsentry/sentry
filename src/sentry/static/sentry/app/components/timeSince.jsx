import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment-timezone';
import _ from 'lodash';

import ConfigStore from 'app/stores/configStore';
import {t} from 'app/locale';

class TimeSince extends React.PureComponent {
  static propTypes = {
    date: PropTypes.any.isRequired,
    suffix: PropTypes.string,
  };

  static getDateObj(date) {
    if (_.isString(date) || _.isNumber(date)) {
      date = new Date(date);
    }
    return date;
  }

  static defaultProps = {
    suffix: 'ago',
  };

  constructor(props) {
    super(props);
    this.state = {
      relative: this.getRelativeDate(),
    };
  }

  componentDidMount() {
    this.setRelativeDateTicker();
  }

  componentWillUnmount() {
    if (this.ticker) {
      clearTimeout(this.ticker);
      this.ticker = null;
    }
  }

  setRelativeDateTicker = () => {
    const ONE_MINUTE_IN_MS = 60000;

    this.ticker = setTimeout(() => {
      this.setState({
        relative: this.getRelativeDate(),
      });
      this.setRelativeDateTicker();
    }, ONE_MINUTE_IN_MS);
  };

  getRelativeDate = () => {
    let date = TimeSince.getDateObj(this.props.date);
    if (!this.props.suffix) {
      return moment(date).fromNow(true);
    } else if (this.props.suffix === 'ago') {
      return moment(date).fromNow();
    } else if (this.props.suffix === 'old') {
      return t('%(time)s old', {time: moment(date).fromNow(true)});
    } else {
      throw new Error('Unsupported time format suffix');
    }
  };

  render() {
    let date = TimeSince.getDateObj(this.props.date);
    let user = ConfigStore.get('user');
    let options = user ? user.options : {};
    let format = options.clock24Hours ? 'MMMM D YYYY HH:mm:ss z' : 'LLL z';
    return (
      <time
        dateTime={date.toISOString()}
        title={moment.tz(date, options.timezone).format(format)}
        className={this.props.className}
      >
        {this.state.relative}
      </time>
    );
  }
}

export default TimeSince;
