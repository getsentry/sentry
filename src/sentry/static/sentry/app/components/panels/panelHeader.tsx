import PropTypes from 'prop-types';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import space from 'app/styles/space';

type Props = {
  /**
   * Do not add padding to left and right of the header
   */
  disablePadding?: boolean;
  /**
   * Usually we place controls at the right of a panel header, to make the
   * spacing between the edges correct we will want less padding on the right.
   * Use this when the panel has somthing such as buttons living there.
   */
  hasButtons?: boolean;
  /**
   * Use light text
   */
  lightText?: boolean;
};

const getPadding = ({disablePadding, hasButtons}: Props) => css`
  padding: ${hasButtons ? space(1) : space(2)} ${disablePadding ? 0 : space(2)};
  padding-right: ${hasButtons ? space(1) : null};
`;

const PanelHeader = styled('div')<Props>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: ${p => (p.lightText ? p.theme.gray500 : p.theme.gray600)};
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  border-bottom: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  background: ${p => p.theme.gray100};
  line-height: 1;
  position: relative;
  ${getPadding};
`;

PanelHeader.propTypes = {
  disablePadding: PropTypes.bool,
  hasButtons: PropTypes.bool,
  lightText: PropTypes.bool,
};

export default PanelHeader;
