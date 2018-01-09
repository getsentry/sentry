import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import PanelHeading from './panelHeading';

const StyledPanelHeader = styled.div`
  border-bottom: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  background: ${p => p.theme.offWhite}
  padding: ${p => (p.disablePadding ? '15px 0' : '15px 20px')};
  text-transform: uppercase;
  font-size: 13px;
`;

const StyledPanelHeading = styled(({lightText, ...props}) => <PanelHeading {...props} />)`
  font-size: inherit;
  text-transform: inherit;
  margin: 0;
  ${p => (p.lightText ? `color: ${p.theme.gray2}` : '')};
`;

class PanelHeader extends React.Component {
  render() {
    return (
      <StyledPanelHeader disablePadding={this.props.disablePadding} {...this.props}>
        <StyledPanelHeading lightText={this.props.lightText}>
          {this.props.children}
        </StyledPanelHeading>
      </StyledPanelHeader>
    );
  }
}

PanelHeader.propTypes = {
  disablePadding: PropTypes.bool,
  lightText: PropTypes.bool,
};

export default PanelHeader;
