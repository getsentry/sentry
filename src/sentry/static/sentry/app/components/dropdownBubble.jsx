import styled, {css} from 'react-emotion';

/**
 * If `blendCorner` is false, then we apply border-radius to all corners
 *
 * Otherwise apply radius to opposite side of `alignMenu` *unles it is fixed width*
 */
const getMenuBorderRadius = ({blendCorner, alignMenu, width, theme}) => {
  const radius = theme.borderRadius;
  if (!blendCorner) {
    return css`
      border-radius: ${radius};
    `;
  }

  // If menu width is the same width as the control
  const isFullWidth = width === '100%';

  // No top border radius if widths match
  const hasTopLeftRadius = !isFullWidth && alignMenu !== 'left';
  const hasTopRightRadius = !isFullWidth && !hasTopLeftRadius;

  return css`
    border-radius: ${hasTopLeftRadius ? radius : 0} ${hasTopRightRadius ? radius : 0}
      ${radius} ${radius};
  `;
};

const getMenuArrow = ({menuWithArrow, alignMenu}) => {
  if (!menuWithArrow) {
    return '';
  }
  const alignRight = alignMenu === 'right';

  return css`
    top: 32px;

    &::before {
      width: 0;
      height: 0;
      border-left: 9px solid transparent;
      border-right: 9px solid transparent;
      border-bottom: 9px solid rgba(52, 60, 69, 0.35);
      content: '';
      display: block;
      position: absolute;
      top: -9px;
      left: 10px;
      z-index: -2;
      ${alignRight && 'left: auto;'};
      ${alignRight && 'right: 10px;'};
    }

    &:after {
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-bottom: 8px solid #fff;
      content: '';
      display: block;
      position: absolute;
      top: -8px;
      left: 11px;
      z-index: -1;
      ${alignRight && 'left: auto;'};
      ${alignRight && 'right: 11px;'};
    }
  `;
};

const DropdownBubble = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.borderDark};
  position: absolute;
  top: calc(100% - 1px);
  ${p => (p.width ? `width: ${p.width}` : '')};
  z-index: ${p =>
    p.theme.zIndex.dropdownAutocomplete
      .menu}; /* This is needed to be able to cover e.g. pagination buttons, but also be below dropdown actor button's zindex */
  right: 0;
  box-shadow: ${p => p.theme.dropShadowLight};
  overflow: hidden;

  ${getMenuBorderRadius};
  ${({alignMenu}) => (alignMenu === 'left' ? 'left: 0;' : '')};

  ${getMenuArrow};
`;

export default DropdownBubble;
