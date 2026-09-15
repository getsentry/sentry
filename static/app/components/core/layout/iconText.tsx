import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {ICON_SIZES} from 'sentry/icons/svgIcon';
import type {IconSize, SpaceSize} from 'sentry/utils/theme';

import {Flex, type FlexProps} from './flex';
import {type Responsive} from './styles';

export interface IconTextProps extends Omit<FlexProps, 'align' | 'direction'> {
  children: ReactNode;
  /**
   * The leading icon or glyph. Vertically centered with the first line of text
   * using the CSS `lh` unit, so alignment stays correct when text wraps.
   */
  icon: ReactNode;
  /**
   * Gap between the icon slot and the text content.
   * @default 'sm'
   */
  gap?: Responsive<SpaceSize | `${SpaceSize} ${SpaceSize}`>;
  /**
   * The icon's rendered size, used for the vertical centering offset.
   * Must match the `size` prop passed to the icon.
   * @default 'md'
   */
  iconSize?: IconSize;
}

/**
 * A flex row that vertically centers a leading icon with the **first line** of
 * adjacent text, regardless of how many lines the text wraps to.
 *
 * Uses the `1lh` CSS unit to compute a `translateY` offset on the icon slot so
 * the icon tracks the text's line-height rather than the overall block height.
 *
 * @see https://ishadeed.com/article/aligning-list-icons/
 */
export function IconText({
  icon,
  iconSize = 'md',
  gap = 'sm',
  children,
  ...rest
}: IconTextProps) {
  return (
    <Flex align="start" gap={gap} {...rest}>
      <IconSlot style={{'--icon-text-size': ICON_SIZES[iconSize]} as React.CSSProperties}>
        {icon}
      </IconSlot>
      <Content>{children}</Content>
    </Flex>
  );
}

const IconSlot = styled('span')`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--icon-text-size);
  transform: translateY(calc((1lh - var(--icon-text-size)) / 2));
`;

const Content = styled('span')`
  min-width: 0;
  flex: 1;
`;
