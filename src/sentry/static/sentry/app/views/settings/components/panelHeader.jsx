import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import PanelHeading from './panelHeading';

const getPadding = ({disablePadding, hasButtons}) => css`
  padding: ${hasButtons ? '8px' : '15px'} ${disablePadding ? '0' : '20px'};
`;

const StyledPanelHeader = styled.div`
  border-bottom: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  background: ${p => p.theme.offWhite};
  text-transform: uppercase;
  font-size: 13px;
  line-height: 1;
  ${getPadding};
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
      <StyledPanelHeader {...this.props}>
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
