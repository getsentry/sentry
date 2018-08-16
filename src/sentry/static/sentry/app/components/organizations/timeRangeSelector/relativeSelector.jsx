import React from 'react';
import PropTypes from 'prop-types';
import {Box} from 'grid-emotion';

import SelectControl from 'app/components/forms/selectControl';

export default class RelativeSelector extends React.Component {
  static propTypes = {
    /**
     * List of choice tuples to use for relative dates
     */
    choices: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)),

    /**
     * The value for selector
     */
    value: PropTypes.string,

    /**
     * Callback when value changes
     */
    onChange: PropTypes.func,
  };

  handleChange = (value, e) => {
    const {onChange} = this.props;
    if (typeof onChange !== 'function') return;

    onChange(value && value.value, e);
  };

  render() {
    const {className, choices, value} = this.props;

    return (
      <Box p={2} className={className}>
        <SelectControl value={value} choices={choices} onChange={this.handleChange} />
      </Box>
    );
  }
}
