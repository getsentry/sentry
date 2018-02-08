import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import PanelHeading from './panelHeading';

const getPadding = ({disablePadding, hasButtons}) => css`
  padding: ${hasButtons ? '8px' : '15px'} ${disablePadding ? '0' : '20px'};
`;

const getFlex = ({isFlex}) => (isFlex ? 'display: flex' : '');

const StyledPanelHeader = styled(({disablePadding, ...props}) => <div {...props} />)`
  border-bottom: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  background: ${p => p.theme.offWhite};
  text-transform: uppercase;
  font-size: 13px;
  line-height: 1;
  ${getPadding};
`;

const StyledPanelHeading = styled(({lightText, isFlex, ...props}) => (
  <PanelHeading {...props} />
))`
  font-size: inherit;
  text-transform: inherit;
  margin: 0;
  ${getFlex};
  ${p => (p.lightText ? `color: ${p.theme.gray2}` : '')};
`;

class PanelHeader extends React.Component {
  render() {
    let {lightText, isFlex, children, ...props} = this.props;

    return (
      <StyledPanelHeader {...props}>
        <StyledPanelHeading lightText={lightText} isFlex={isFlex}>
          {children}
        </StyledPanelHeading>
      </StyledPanelHeader>
    );
  }
}

PanelHeader.propTypes = {
  isFlex: PropTypes.bool,
  disablePadding: PropTypes.bool,
  lightText: PropTypes.bool,
};

export default PanelHeader;
