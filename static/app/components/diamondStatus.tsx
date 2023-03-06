import styled from '@emotion/styled';

import {IconDiamond} from 'sentry/icons';
import {SVGIconProps} from 'sentry/icons/svgIcon';
import {ColorOrAlias} from 'sentry/utils/theme';

interface DiamondStatusProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Color of the diamond
   */
  color: ColorOrAlias;
  /**
   * Icon component to render inside of the diamond
   */
  icon: React.ComponentType<SVGIconProps>;
}

/**
 * A status indicator that renders a icon within a diamond
 */
function DiamondStatus({color, icon: Icon, ...props}: DiamondStatusProps) {
  return (
    <StatusWrapper role="presentation" color={color} {...props}>
      <DiamondBackground color={color} />
      <Icon color="white" />
    </StatusWrapper>
  );
}

export {DiamondStatus};

const DiamondBackground = styled(IconDiamond)`
  width: 36px;
  height: 36px;
`;

const StatusWrapper = styled('div')<{color: ColorOrAlias}>`
  width: 36px;
  height: 36px;
  position: relative;

  svg:last-child {
    width: 16px;
    z-index: 2;
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    margin: auto;
  }
`;
