import React from 'react';
import PropTypes from 'prop-types';
import {Box} from 'grid-emotion';

import SelectControl from 'app/components/forms/selectControl';
import DateTimeField from 'app/components/forms/dateTimeField';
import {t} from 'app/locale';

import {parseStatsPeriod} from './utils';

export default class CombinedSelector extends React.Component {
  static propTypes = {
    /**
     * List of choice tuples to use for relative dates
     */
    choices: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)),

    /**
     * The value for selector. This will be 'custom' if absolute dates are being used
     */
    relative: PropTypes.string,

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

  static defaultProps = {
    relative: null,
    start: null,
    end: null,
  };

  handleChange(prop, val) {
    const {start, end, relative, onChange} = this.props;
    const prev = {
      start,
      end,
      relative,
    };

    if (prop === 'relative') {
      if (val === 'custom') {
        // Convert previous relative range to absolute values
        const statsPeriod = parseStatsPeriod(relative);
        onChange({
          relative: null,
          start: statsPeriod.start,
          end: statsPeriod.end,
        });
      } else {
        onChange({relative: val, start: null, end: null});
      }
    } else {
      onChange({...prev, relative: null, [prop]: val});
    }
  }

  render() {
    const {className, start, end, relative, choices} = this.props;

    const value = relative || 'custom';

    return (
      <Box className={className}>
        <Box mb={1}>{t('Update time range (UTC)')}</Box>
        <Box mb={1}>
          <SelectControl
            value={value}
            choices={[...choices, ['custom', t('Custom')]]}
            onChange={val => this.handleChange('relative', val.value)}
          />
        </Box>
        {relative === null && (
          <React.Fragment>
            <Box mb={1}>
              <DateTimeField
                name="start"
                label={t('From')}
                value={start}
                onChange={val => this.handleChange('start', val)}
              />
            </Box>
            <Box mb={1}>
              <DateTimeField
                name="end"
                label={t('To')}
                value={end}
                onChange={val => this.handleChange('end', val)}
              />
            </Box>
          </React.Fragment>
        )}
      </Box>
    );
  }
}
