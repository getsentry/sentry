import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment-timezone';
import _ from 'lodash';

import ConfigStore from '../stores/configStore';

class DateTime extends React.Component {
  static propTypes = {
    date: PropTypes.any.isRequired,
    dateOnly: PropTypes.bool,
    shortDate: PropTypes.bool,
    seconds: PropTypes.bool,
  };

  static defaultProps = {
    seconds: true,
  };

  getFormat = ({clock24Hours}) => {
    let {dateOnly, seconds, shortDate} = this.props;

    // October 26, 2017
    if (dateOnly) {
      return 'LL';
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
    let {
      date,
      // eslint-disable-next-line no-unused-vars
      seconds,
      // eslint-disable-next-line no-unused-vars
      shortDate,
      // eslint-disable-next-line no-unused-vars
      dateOnly,
      ...carriedProps
    } = this.props;
    let user = ConfigStore.get('user');
    let options = user ? user.options : {};
    let format = this.getFormat(options);

    if (_.isString(date) || _.isNumber(date)) {
      date = new Date(date);
    }

    return (
      <time {...carriedProps}>{moment.tz(date, options.timezone).format(format)}</time>
    );
  }
}

export default DateTime;
