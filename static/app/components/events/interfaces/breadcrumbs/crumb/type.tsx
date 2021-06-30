import {ComponentProps, ComponentType, CSSProperties, memo} from 'react';
import styled from '@emotion/styled';

import SvgIcon from 'app/icons/svgIcon';
import {Color} from 'app/utils/theme';

type SvgIconProps = ComponentProps<typeof SvgIcon>;

import {BreadcrumbsWithDetails} from 'app/types/breadcrumbs';

type Props = Pick<BreadcrumbsWithDetails[0], 'color' | 'icon'> &
  Pick<SvgIconProps, 'size'>;

const Type = memo(({icon, color, size}: Props) => {
  const Svg = icon as ComponentType<SvgIconProps>;
  return (
    <Wrapper color={color}>
      <Svg size={size} />
    </Wrapper>
  );
});

export default Type;

const Wrapper = styled('div')<{
  color?: Color | CSSProperties['color'];
  size?: number;
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: ${p => p.theme.background};
  box-shadow: ${p => p.theme.dropShadowLightest};
  border-radius: 32px;
  z-index: ${p => p.theme.zIndex.breadcrumbs.iconWrapper};
  position: relative;
  border: 1px solid ${p => p.theme.border};
  color: ${p => p.theme.textColor};
  ${p =>
    p.color &&
    `
      color: ${p.theme[p.color] || p.color};
      border-color: ${p.theme[p.color] || p.color};
    `}
`;
