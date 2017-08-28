/* global process */
// eslint-disable-next-line no-unused-vars
import React, {PropTypes} from 'react';

const DynamicWrapper = ({fixed, value, ...otherProps}) => {
  // Wrap with span b/c react
  return (
    <span {...otherProps}>
      {process.env.IS_PERCY ? fixed : value}
    </span>
  );
};

DynamicWrapper.propTypes = {
  /**
   * Value to display when `process.env.IS_PERCY` is truthy
   */
  fixed: PropTypes.string.isRequired,
  /**
   * Actual value to use when not in a test environment
   */
  value: PropTypes.string.isRequired
};

export default DynamicWrapper;
