import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import space from 'app/styles/space';

type Props = React.ComponentProps<typeof Alert>;

const DEFAULT_ICONS = {
  info: 'icon-circle-info',
  error: 'icon-circle-close',
  warning: 'icon-circle-exclamation',
  success: 'icon-circle-success',
};

// Margin bottom should probably be a different prop
const PanelAlert = styled(({icon, ...props}: Props) => (
  <Alert {...props} icon={icon || DEFAULT_ICONS[props.type!]} system />
))`
  margin: 0 0 1px 0;
  padding: ${space(2)};
  border-radius: 0;
  box-shadow: none;
`;

PanelAlert.propTypes = {
  ...Alert.propTypes,
  type: PropTypes.oneOf(['info', 'warning', 'success', 'error', 'muted']),
};

export default PanelAlert;
