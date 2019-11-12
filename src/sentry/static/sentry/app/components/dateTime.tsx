import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment-timezone';

import ConfigStore from 'app/stores/configStore';

type Props = {
  date: moment.MomentInput;
  dateOnly?: boolean;
  timeOnly?: boolean;
  shortDate?: boolean;
  seconds?: boolean;
  utc?: boolean;
};

class DateTime extends React.Component<Props> {
  static propTypes = {
    date: PropTypes.any.isRequired,
    dateOnly: PropTypes.bool,
    timeOnly: PropTypes.bool,
    shortDate: PropTypes.bool,
    seconds: PropTypes.bool,
    utc: PropTypes.bool,
  };

  static defaultProps = {
    seconds: true,
  };

  getFormat = ({clock24Hours}: {clock24Hours: boolean}): string => {
    const {dateOnly, timeOnly, seconds, shortDate} = this.props;

    // October 26, 2017
    if (dateOnly) {
      return 'LL';
    }

    // 4:57 PM
    if (timeOnly) {
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
      seconds, // eslint-disable-line no-unused-vars
      shortDate, // eslint-disable-line no-unused-vars
      dateOnly, // eslint-disable-line no-unused-vars
      utc,
      timeOnly: _timeOnly, // eslint-disable-line no-unused-vars
      ...carriedProps
    } = this.props;
    const user = ConfigStore.get('user');
    const options = user ? user.options : {};
    const format = this.getFormat(options);

    return (
      <time {...carriedProps}>
        {utc
          ? moment.utc(date).format(format)
          : moment.tz(date, options.timezone).format(format)}
      </time>
    );
  }
}

export default DateTime;
