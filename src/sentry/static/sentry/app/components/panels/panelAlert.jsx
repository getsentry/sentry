import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Alert from 'app/components/alert';

const DEFAULT_ICONS = {
  info: 'icon-circle-info',
  error: 'icon-circle-close',
  warning: 'icon-circle-exclamation',
  success: 'icon-circle-success',
};

// Margin bottom should probably be a different prop
const PanelAlert = styled(({type, icon, ...props}) => (
  <Alert {...props} icon={icon || DEFAULT_ICONS[type]} type={type} />
))`
  ${p =>
    typeof p.m !== 'undefined'
      ? `margin: -${p.m * p.theme.grid + 1}px -${p.m * p.theme.grid + 1}px;`
      : ''};
  ${p => (typeof p.mb !== 'undefined' ? `margin-bottom: ${p.mb * p.theme.grid};` : '')};
  border-radius: 0;
`;

PanelAlert.propTypes = {
  /**
   * Number of grid units to use for component's negative margin.
   */
  m: PropTypes.number,
  /**
   * margin-bottom
   */
  mb: PropTypes.number,
  type: PropTypes.oneOf(['info', 'warning', 'success', 'error']),
  icon: PropTypes.string,
};

PanelAlert.defaultProps = {
  m: 0,
  mb: 0,
};

export default PanelAlert;
