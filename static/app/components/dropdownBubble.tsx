import {forwardRef} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {css, Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import PanelProvider from 'sentry/utils/panelProvider';
import SettingsHeader from 'sentry/views/settings/components/settingsHeader';

interface DropdownBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Menu alignment
   */
  alignMenu: 'left' | 'right';
  /**
   * If this is true, will make a single corner blended with actor (depends on anchor orientation)
   */
  blendCorner: boolean;
  /**
   * If this is true, will make corners blend with its opener (so no border radius)
   */
  blendWithActor?: boolean;
  /**
   * If true, the menu will be visually detached from actor.
   */
  detached?: boolean;
  /**
   * The width of the menu
   */
  width?: string;
}

/**
 * If `blendCorner` is false, then we apply border-radius to all corners
 *
 * Otherwise apply radius to opposite side of `alignMenu` *unless it is fixed width*
 */
const getMenuBorderRadius = ({
  blendWithActor,
  blendCorner,
  detached,
  alignMenu,
  width,
  theme,
}: DropdownBubbleProps & {theme: Theme}) => {
  const radius = theme.panelBorderRadius;
  if (!blendCorner || detached) {
    return css`
      border-radius: ${radius};
    `;
  }

  // If menu width is the same width as the control
  const isFullWidth = width === '100%';

  // No top border radius if widths match
  const hasTopLeftRadius = !blendWithActor && !isFullWidth && alignMenu !== 'left';
  const hasTopRightRadius = !blendWithActor && !isFullWidth && !hasTopLeftRadius;

  return css`
    border-radius: ${hasTopLeftRadius ? radius : 0} ${hasTopRightRadius ? radius : 0}
      ${radius} ${radius};
  `;
};

const DropdownBubble = styled(
  forwardRef<HTMLDivElement, DropdownBubbleProps>(
    ({children, ...props}, forwardedRef) => (
      <div ref={forwardedRef} {...props}>
        <PanelProvider>{children}</PanelProvider>
      </div>
    )
  ),
  {shouldForwardProp: prop => typeof prop === 'string' && isPropValid(prop)}
)`
  background: ${p => p.theme.background};
  color: ${p => p.theme.textColor};
  border: 1px solid ${p => p.theme.border};
  position: absolute;
  right: 0;

  ${p => (p.width ? `width: ${p.width}` : '')};
  ${p => (p.alignMenu === 'left' ? 'left: 0;' : '')};

  ${p =>
    p.detached
      ? `
    top: 100%;
    margin-top: ${space(1)};
    box-shadow: ${p.theme.dropShadowHeavy};
  `
      : `
    top: calc(100% - 1px);
    box-shadow: ${p.theme.dropShadowMedium};
  `};

  ${getMenuBorderRadius};

  /* This is needed to be able to cover e.g. pagination buttons, but also be
   * below dropdown actor button's zindex */
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.menu};

  ${SettingsHeader} & {
    z-index: ${p => p.theme.zIndex.dropdownAutocomplete.menu + 2};
  }
`;

export default DropdownBubble;
