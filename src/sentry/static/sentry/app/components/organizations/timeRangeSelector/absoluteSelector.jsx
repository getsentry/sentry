import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import {Box} from 'grid-emotion';

import DateTimeField from 'app/components/forms/dateTimeField';
import {t} from 'app/locale';

export default class AbsoluteSelector extends React.Component {
  static propTypes = {
    /**
     * Start date value for absolute date selector
     */
    start: PropTypes.string,
    /**
     * End date value for absolute date selector
     */
    end: PropTypes.string,

    /**
     * Callback when value changes
     */
    onChange: PropTypes.func,
  };

  formatDate(date) {
    return moment(date).format('MMMM D, h:mm a');
  }

  render() {
    const {className, start, end, onChange} = this.props;

    return (
      <Box className={className}>
        <Box mb={1}>{t('Update time range (UTC)')}</Box>
        <Box mb={1}>
          <DateTimeField
            name="start"
            label={t('From')}
            value={start}
            onChange={val => onChange('start', val)}
          />
        </Box>
        <Box mb={1}>
          <DateTimeField
            name="end"
            label={t('To')}
            value={end}
            onChange={val => onChange('end', val)}
          />
        </Box>
      </Box>
    );
  }
}
