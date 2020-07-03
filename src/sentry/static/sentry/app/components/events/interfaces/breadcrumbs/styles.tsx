import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {Color} from 'app/utils/theme';
import space from 'app/styles/space';

// TODO(style): the color #fffcfb and  #e7c0bc are not yet in theme and no similar theme's color was found.
const BreadCrumb = styled('li')<{hasError?: boolean}>`
  font-size: ${p => p.theme.fontSizeMedium};
  position: relative;
  padding: ${space(1)} ${space(3)} ${space(0.75)} ${space(3)} !important;
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
    background: ${p => p.theme.borderLight};
    position: absolute;
  }
  border-bottom: 1px solid ${p => p.theme.borderLight};
  :last-child:before {
    bottom: calc(100% - ${space(1)});
  }
  ${p =>
    p.hasError &&
    css`
      background: #fffcfb;
      border: 1px solid #e7c0bc;
      margin: -1px;
    `}
`;

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
  border: 1px solid ${p => (p.color ? p.theme[p.color] : p.theme.gray500)};
`;

export {BreadCrumb, BreadCrumbIconWrapper};
