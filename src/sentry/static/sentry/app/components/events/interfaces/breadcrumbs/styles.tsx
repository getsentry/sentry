import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {Color} from 'app/utils/theme';
import space from 'app/styles/space';

// TODO(style): color #e7eaef and #e7c0bc are not yet in theme
const BreadCrumb = styled('li')<{error?: boolean}>`
  font-size: ${p => p.theme.fontSizeMedium};
  position: relative;
  padding: ${space(1)} ${space(3)} ${space(0.75)} ${space(3)} !important;
  margin: 0 -1px;
  display: grid;
  grid-template-columns: 26px 1fr 50px;
  grid-gap: ${space(1.5)};
  :before {
    content: '';
    display: block;
    width: 2px;
    top: 0;
    bottom: 0;
    left: 32px;
    background: #e7eaef;
    position: absolute;
  }
  border-bottom: 1px solid #e7e4eb;
  ${p =>
    p.error &&
    css`
      background: #fffcfb;
      border: 1px solid #e7c0bc;
      margin: -2px;
    `}
`;

// TODO(style): color #968ba0 is not yet in theme
const BreadCrumbIconWrapper = styled('div')<{color?: Color; borderColor?: Color}>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: ${p => p.theme.white};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  border-radius: 32px;
  z-index: 1;
  position: relative;
  color: ${p => (p.color ? p.theme[p.color] : 'inherit')};
  border-color: ${p => (p.borderColor ? p.theme[p.borderColor] : 'currentColor')};
  border: 1px solid ${p => (p.color ? p.theme[p.color] : '#968ba0')};
`;

export {BreadCrumb, BreadCrumbIconWrapper};
