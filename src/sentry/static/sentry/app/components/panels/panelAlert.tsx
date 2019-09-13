import React from 'react';
import styled from 'react-emotion';

import Alert from 'app/components/alert';

type Props = React.PropsWithoutRef<React.ComponentProps<typeof Alert>>;

const DEFAULT_ICONS = {
  info: 'icon-circle-info',
  error: 'icon-circle-close',
  warning: 'icon-circle-exclamation',
  success: 'icon-circle-success',
};

// Margin bottom should probably be a different prop
const PanelAlert = styled(({type = 'info', icon, ...props}: Props) => (
  <Alert {...props} icon={icon || DEFAULT_ICONS[type]} type={type} system />
))<Props>`
  margin: 0 0 1px 0;
  border-radius: 0;
`;

PanelAlert.propTypes = Alert.propTypes;

export default PanelAlert;
