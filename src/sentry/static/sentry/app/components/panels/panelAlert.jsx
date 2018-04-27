import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Alert from 'app/components/alert';

// Margin bottom should probably be a different prop
const StyledPanelAlert = styled(Alert)`
  ${p =>
    typeof p.m !== 'undefined'
      ? `margin: -${p.m * p.theme.grid + 1}px -${p.m * p.theme.grid + 1}px;`
      : ''};
  ${p => (typeof p.mb !== 'undefined' ? `margin-bottom: ${p.mb * p.theme.grid};` : '')};
  border-radius: 0;
`;

const DEFAULT_ICONS = {
  info: 'icon-circle-info',
  error: 'icon-circle-close',
  warning: 'icon-circle-exclamation',
  success: 'icon-circle-success',
};

class PanelAlert extends React.Component {
  static propTypes = {
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

  static defaultProps = {
    m: 0,
    mb: 0,
  };

  render() {
    let {type, icon, ...props} = this.props;
    let iconOrDefault = icon || DEFAULT_ICONS[type];

    return <StyledPanelAlert {...props} icon={iconOrDefault} type={type} />;
  }
}

export default PanelAlert;
