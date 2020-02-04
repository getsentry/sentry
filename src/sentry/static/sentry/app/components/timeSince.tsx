import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment-timezone';

import ConfigStore from 'app/stores/configStore';
import {t} from 'app/locale';

const ONE_MINUTE_IN_MS = 60000;

type RelaxedDateType = string | number | Date;

type DefaultProps = {
  /**
   * Suffix after elapsed time
   * e.g. "ago" in "5 minutes ago"
   */
  suffix: string;
};

type Props = DefaultProps & {
  /**
   * The date value, can be string, number (e.g. timestamp), or instance of Date
   */
  date: RelaxedDateType;

  className?: string;
};

type State = {
  relative: string;
};

class TimeSince extends React.PureComponent<Props, State> {
  static propTypes = {
    date: PropTypes.any.isRequired,
    suffix: PropTypes.string,
  };

  static defaultProps: DefaultProps = {
    suffix: 'ago',
  };

  state = {
    relative: '',
  };

  // TODO(ts) TODO(emotion): defining the props type breaks emotion's typings
  // See: https://github.com/emotion-js/emotion/pull/1514
  static getDerivedStateFromProps(props) {
    return {
      relative: getRelativeDate(props.date, props.suffix),
    };
  }

  componentDidMount() {
    this.setRelativeDateTicker();
  }

  componentWillUnmount() {
    if (this.ticker) {
      window.clearTimeout(this.ticker);
      this.ticker = null;
    }
  }

  ticker: number | null = null;

  setRelativeDateTicker = () => {
    this.ticker = window.setTimeout(() => {
      this.setState({
        relative: getRelativeDate(this.props.date, this.props.suffix),
      });
      this.setRelativeDateTicker();
    }, ONE_MINUTE_IN_MS);
  };

  render() {
    const {date, suffix: _suffix, className, ...props} = this.props;
    const dateObj = getDateObj(date);
    const user = ConfigStore.get('user');
    const options = user ? user.options : {};
    const format = options.clock24Hours ? 'MMMM D YYYY HH:mm:ss z' : 'LLL z';

    return (
      <time
        dateTime={dateObj.toISOString()}
        title={moment.tz(dateObj, options.timezone).format(format)}
        className={className}
        {...props}
      >
        {this.state.relative}
      </time>
    );
  }
}

export default TimeSince;

function getDateObj(date: RelaxedDateType): Date {
  if (isString(date) || isNumber(date)) {
    date = new Date(date);
  }
  return date;
}

function getRelativeDate(currentDateTime: RelaxedDateType, suffix?: string): string {
  const date = getDateObj(currentDateTime);

  if (!suffix) {
    return moment(date).fromNow(true);
  } else if (suffix === 'ago') {
    return moment(date).fromNow();
  } else if (suffix === 'old') {
    return t('%(time)s old', {time: moment(date).fromNow(true)});
  } else {
    throw new Error('Unsupported time format suffix');
  }
}
