import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import {IconCheckmark, IconClose, IconInfo, IconWarning} from 'app/icons';

import Alert from 'app/components/alert';

type Props = React.ComponentProps<typeof Alert>;

const DEFAULT_ICONS = {
  info: <IconInfo />,
  error: <IconClose circle />,
  warning: <IconWarning />,
  success: <IconCheckmark circle />,
};

// Margin bottom should probably be a different prop
const PanelAlert = styled(({icon, ...props}: Props) => (
  <Alert {...props} icon={icon || DEFAULT_ICONS[props.type!]} system />
))`
  margin: 0 0 1px 0;
  border-radius: 0;
`;

PanelAlert.propTypes = {
  ...Alert.propTypes,
  type: PropTypes.oneOf(['info', 'warning', 'success', 'error', 'muted']),
};

export default PanelAlert;
