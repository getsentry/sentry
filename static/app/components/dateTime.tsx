import {Component} from 'react';
import moment from 'moment';
import momentTimezone from 'moment-timezone';

import ConfigStore from 'app/stores/configStore';

type DefaultProps = {
  seconds: boolean;
};

type Props = DefaultProps & {
  date: moment.MomentInput | momentTimezone.MomentInput;
  dateOnly?: boolean;
  timeOnly?: boolean;
  shortDate?: boolean;
  timeAndDate?: boolean;
  utc?: boolean;
  format?: string;
};

class DateTime extends Component<Props> {
  static defaultProps: DefaultProps = {
    seconds: true,
  };

  getFormat = ({clock24Hours}: {clock24Hours: boolean}): string => {
    const {dateOnly, timeOnly, seconds, shortDate, timeAndDate, format} = this.props;

    if (format) {
      return format;
    }

    // October 26, 2017
    if (dateOnly) {
      return 'LL';
    }

    // Oct 26, 11:30 AM
    if (timeAndDate) {
      if (clock24Hours) {
        return 'MMM DD, HH:mm';
      }

      return 'MMM DD, LT';
    }

    // 4:57 PM
    if (timeOnly) {
      if (clock24Hours) {
        return 'HH:mm';
      }

      return 'LT';
    }

    if (shortDate) {
      return 'MM/DD/YYYY';
    }

    // Oct 26, 2017 11:30
    if (clock24Hours) {
      return 'MMM D, YYYY HH:mm';
    }

    // Oct 26, 2017 11:30:30 AM
    if (seconds) {
      return 'll LTS z';
    }

    // Default is Oct 26, 2017 11:30 AM
    return 'lll';
  };

  render() {
    const {
      date,
      utc,
      seconds: _seconds,
      shortDate: _shortDate,
      dateOnly: _dateOnly,
      timeOnly: _timeOnly,
      timeAndDate: _timeAndDate,
      ...carriedProps
    } = this.props;
    const user = ConfigStore.get('user');
    const options = user?.options;
    const format = this.getFormat(options);

    return (
      <time {...carriedProps}>
        {utc
          ? moment.utc(date as moment.MomentInput).format(format)
          : momentTimezone.tz(date, options?.timezone ?? '').format(format)}
      </time>
    );
  }
}

export default DateTime;
