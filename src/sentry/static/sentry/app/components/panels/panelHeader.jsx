import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';
import space from 'app/styles/space';

const getPadding = ({disablePadding, hasButtons}) => css`
  padding: ${hasButtons ? space(1) : space(2)} ${disablePadding ? 0 : space(2)};
  /**
   * Usually we place controls at the right of a panel header, to make the
   * spacing between the edges correct we will want less padding on the right.
   */
  padding-right: ${hasButtons ? space(1) : null};
`;

const PanelHeader = styled(({disablePadding, hasButtons, ...props}) => (
  <Flex align="center" justify="space-between" {...props} />
))`
  color: ${p => (p.lightText ? p.theme.gray2 : p.theme.gray3)};
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  border-bottom: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  background: ${p => p.theme.offWhite};
  line-height: 1;
  position: relative;
  ${getPadding};
`;

PanelHeader.propTypes = {
  disablePadding: PropTypes.bool,
  hasButtons: PropTypes.bool,
  lightText: PropTypes.bool,
  ...Flex.propTypes,
};

export default PanelHeader;
