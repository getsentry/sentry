import {PureComponent} from 'react';
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import moment from 'moment-timezone';

import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {getDuration} from 'sentry/utils/formatters';
import getDynamicText from 'sentry/utils/getDynamicText';
import {ColorOrAlias} from 'sentry/utils/theme';

import Tooltip from './tooltip';

const ONE_MINUTE_IN_MS = 60000;

type RelaxedDateType = string | number | Date;

interface DefaultProps {
  /**
   * Suffix after elapsed time
   * e.g. "ago" in "5 minutes ago"
   */
  suffix: string;
}

interface Props extends DefaultProps, React.TimeHTMLAttributes<HTMLTimeElement> {
  /**
   * The date value, can be string, number (e.g. timestamp), or instance of Date
   */
  date: RelaxedDateType;

  className?: string;

  /**
   * By default we show tooltip with absolute date on hover, this prop disables that
   */
  disabledAbsoluteTooltip?: boolean;
  /**
   * Shortens the shortened relative time
   * min to m, hr to h
   */
  extraShort?: boolean;

  /**
   * For relative time shortens minutes to min, hour to hr etc.
   */
  shorten?: boolean;

  tooltipTitle?: React.ReactNode;

  tooltipUnderlineColor?: ColorOrAlias;
}

type State = {
  relative: string;
};

class TimeSince extends PureComponent<Props, State> {
  static defaultProps: DefaultProps = {
    suffix: 'ago',
  };

  state: State = {
    relative: '',
  };

  // TODO(ts) TODO(emotion): defining the props type breaks emotion's typings
  // See: https://github.com/emotion-js/emotion/pull/1514
  static getDerivedStateFromProps(props) {
    return {
      relative: getRelativeDate(
        props.date,
        props.suffix,
        props.shorten,
        props.extraShort
      ),
    };
  }

  componentDidMount() {
    this.setRelativeDateTicker();
  }

  componentWillUnmount() {
    window.clearTimeout(this.tickerTimeout);
  }

  tickerTimeout: number | undefined = undefined;

  setRelativeDateTicker = () => {
    window.clearTimeout(this.tickerTimeout);
    this.tickerTimeout = window.setTimeout(() => {
      this.setState({
        relative: getRelativeDate(
          this.props.date,
          this.props.suffix,
          this.props.shorten,
          this.props.extraShort
        ),
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
      tooltipTitle,
      tooltipUnderlineColor,
      shorten: _shorten,
      extraShort: _extraShort,
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
      <Tooltip
        disabled={disabledAbsoluteTooltip}
        underlineColor={tooltipUnderlineColor}
        showUnderline
        title={
          <div>
            <div>{tooltipTitle}</div>
            {tooltip}
          </div>
        }
      >
        <time dateTime={dateObj?.toISOString()} className={className} {...props}>
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

export function getRelativeDate(
  currentDateTime: RelaxedDateType,
  suffix?: string,
  shorten?: boolean,
  extraShort?: boolean
): string {
  const date = getDateObj(currentDateTime);

  if ((shorten || extraShort) && suffix) {
    return t('%(time)s %(suffix)s', {
      time: getDuration(moment().diff(moment(date), 'seconds'), 0, shorten, extraShort),
      suffix,
    });
  }
  if ((shorten || extraShort) && !suffix) {
    return getDuration(moment().diff(moment(date), 'seconds'), 0, shorten, extraShort);
  }
  if (!suffix) {
    return moment(date).fromNow(true);
  }
  if (suffix === 'ago') {
    return moment(date).fromNow();
  }

  return t('%(time)s %(suffix)s', {time: moment(date).fromNow(true), suffix});
}
