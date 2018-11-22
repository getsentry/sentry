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
  margin: -1px;
  border-radius: 0;
`;

PanelAlert.propTypes = {
  type: PropTypes.oneOf(['info', 'warning', 'success', 'error', 'default']),
  icon: PropTypes.string,
};

export default PanelAlert;
