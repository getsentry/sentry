import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment-timezone';

import ConfigStore from 'app/stores/configStore';
import {t} from 'app/locale';
import getDynamicText from 'app/utils/getDynamicText';

import Tooltip from './tooltip';

const ONE_MINUTE_IN_MS = 60000;

type RelaxedDateType = string | number | Date;

type DefaultProps = {
  /**
   * Suffix after elapsed time
   * e.g. "ago" in "5 minutes ago"
   */
  suffix: string;
};

type TimeProps = React.HTMLProps<HTMLTimeElement>;

type Props = DefaultProps & {
  /**
   * The date value, can be string, number (e.g. timestamp), or instance of Date
   */
  date: RelaxedDateType;

  /**
   * By default we show tooltip with absolute date on hover, this prop disables that
   */
  disabledAbsoluteTooltip?: boolean;

  className?: string;
} & TimeProps;

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
    const {
      date,
      suffix: _suffix,
      disabledAbsoluteTooltip,
      className,
      ...props
    } = this.props;
    const dateObj = getDateObj(date);
    const user = ConfigStore.get('user');
    const options = user ? user.options : null;
    const format = options?.clock24Hours ? 'MMMM D, YYYY HH:mm z' : 'LLL z';
    const tooltip = getDynamicText({
      fixed: options?.clock24Hours
        ? 'November 3, 2020 08:57 UTC'
        : 'November 3, 2020 8:58 AM UTC',
      value: moment.tz(dateObj, options?.timezone ?? '').format(format),
    });

    return (
      <Tooltip title={tooltip} disabled={disabledAbsoluteTooltip}>
        <time dateTime={dateObj.toISOString()} className={className} {...props}>
          {this.state.relative}
        </time>
      </Tooltip>
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
