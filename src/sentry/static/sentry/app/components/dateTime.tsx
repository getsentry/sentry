import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment-timezone';

import ConfigStore from 'app/stores/configStore';

type DefaultProps = {
  seconds: boolean;
};

type Props = DefaultProps & {
  date: moment.MomentInput;
  dateOnly?: boolean;
  timeOnly?: boolean;
  shortDate?: boolean;
  timeAndDate?: boolean;
  utc?: boolean;
};

class DateTime extends React.Component<Props> {
  static propTypes = {
    date: PropTypes.any.isRequired,
    dateOnly: PropTypes.bool,
    timeOnly: PropTypes.bool,
    shortDate: PropTypes.bool,
    seconds: PropTypes.bool,
    timeAndDate: PropTypes.bool,
    utc: PropTypes.bool,
  };

  static defaultProps: DefaultProps = {
    seconds: true,
  };

  getFormat = ({clock24Hours}: {clock24Hours: boolean}): string => {
    const {dateOnly, timeOnly, seconds, shortDate, timeAndDate} = this.props;

    // October 26, 2017
    if (dateOnly) {
      return 'LL';
    }

    // Oct 26, 2017 11:30:30 AM
    if (timeAndDate) {
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

    if (clock24Hours) {
      return 'MMMM D YYYY HH:mm:ss z';
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
          ? moment.utc(date).format(format)
          : moment.tz(date, options?.timezone ?? '').format(format)}
      </time>
    );
  }
}

export default DateTime;
