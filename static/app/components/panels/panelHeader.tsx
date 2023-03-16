import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

type Props = {
  /**
   * Do not add padding to left and right of the header
   */
  disablePadding?: boolean;
  /**
   * Usually we place controls at the right of a panel header, to make the
   * spacing between the edges correct we will want less padding on the right.
   * Use this when the panel has something such as buttons living there.
   */
  hasButtons?: boolean;
  /**
   * Use light text
   */
  lightText?: boolean;
};

const getPadding = ({disablePadding, hasButtons}: Props) => css`
  padding: ${hasButtons ? space(1) : space(2)} ${disablePadding ? 0 : space(2)};
`;

const PanelHeader = styled('div')<Props>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: ${p => (p.lightText ? p.theme.gray300 : p.theme.gray400)};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  text-transform: uppercase;
  border-bottom: 1px solid ${p => p.theme.border};
  border-radius: calc(${p => p.theme.panelBorderRadius} - 1px)
    calc(${p => p.theme.panelBorderRadius} - 1px) 0 0;
  background: ${p => p.theme.backgroundSecondary};
  line-height: 1;
  position: relative;
  ${getPadding};
`;

export default PanelHeader;
