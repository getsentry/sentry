/* global process */
// eslint-disable-next-line no-unused-vars
import PropTypes from 'prop-types';
import React from 'react';

import getDynamicText from 'app/utils/getDynamicText';

// XXX: Most likely you can just use getDynamicText instead
const DynamicWrapper = ({fixed, value, ...otherProps}) => {
  // Wrap with span b/c react
  return <span {...otherProps}>{getDynamicText({value, fixed})}</span>;
};

DynamicWrapper.propTypes = {
  /**
   * Value to display when `process.env.IS_PERCY` is truthy
   */
  fixed: PropTypes.node.isRequired,
  /**
   * Actual value to use when not in a test environment
   */
  value: PropTypes.node.isRequired,
};

export default DynamicWrapper;
