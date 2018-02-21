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
  };

  static defaultProps = {};

  render() {
    let {m, mb, theme, ...props} = this.props;
    let marginSize = typeof m !== 'undefined' ? m : theme.grid;
    let marginBottom = typeof mb !== 'undefined' ? mb : theme.grid;

    return <StyledPanelAlert {...props} m={marginSize} mb={marginBottom} />;
  }
}

export default withTheme(PanelAlert);
