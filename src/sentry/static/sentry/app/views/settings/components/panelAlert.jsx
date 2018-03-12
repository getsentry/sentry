import {withTheme} from 'emotion-theming';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Alert from '../../../components/alert';

// Margin bottom should probably be a different prop
const StyledPanelAlert = styled(Alert)`
  margin: ${p => `-${p.m * 2 + 1}px -${p.m * 2 + 1}px ${p.mb * 3}px`};
  border-radius: 0;
`;

const DEFAULT_ICONS = {
  info: 'icon-circle-question',
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
    theme: PropTypes.object,
    type: PropTypes.oneOf(['info', 'warning', 'success', 'error']),
    icon: PropTypes.string,
  };

  static defaultProps = {};

  render() {
    let {m, mb, theme, type, icon, ...props} = this.props;
    let marginSize = typeof m !== 'undefined' ? m : theme.grid;
    let marginBottom = typeof mb !== 'undefined' ? mb : theme.grid;
    let iconOrDefault = icon || DEFAULT_ICONS[type];

    return (
      <StyledPanelAlert
        {...props}
        icon={iconOrDefault}
        type={type}
        m={marginSize}
        mb={marginBottom}
      />
    );
  }
}

export default withTheme(PanelAlert);
