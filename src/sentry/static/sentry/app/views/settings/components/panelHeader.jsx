import React from 'react';
import styled from 'react-emotion';

import PanelHeading from './panelHeading';

const StyledPanelHeader = styled.div`
  border-bottom: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.radius} ${p => p.theme.radius} 0 0;
  background: ${p => p.theme.offWhite}
  padding: ${p => (p.disablePadding ? '15px 0' : '15px 20px')};
  text-transform: uppercase;
  font-size: 13px;
`;

const StyledPanelHeaderHeading = styled(PanelHeading)`
  font-size: inherit;
  text-transform: inherit;
  margin: 0;
`;

class PanelHeader extends React.Component {
  render() {
    return (
      <StyledPanelHeader disablePadding={this.props.disablePadding} {...this.props}>
        <StyledPanelHeaderHeading>{this.props.children}</StyledPanelHeaderHeading>
      </StyledPanelHeader>
    );
  }
}

PanelHeader.propTypes = {
  disablePadding: React.PropTypes.bool,
};

export default PanelHeader;
