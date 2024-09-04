import styled from '@emotion/styled';

import type {TooltipProps} from 'sentry/components/tooltip';
import {Tooltip} from 'sentry/components/tooltip';
import {IconInfo} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import type {IconSize} from 'sentry/utils/theme';

interface InfoTooltipProps
  extends Partial<
    Pick<
      TooltipProps,
      'containerDisplayMode' | 'isHoverable' | 'overlayStyle' | 'position'
    >
  > {
  /**
   * Sets the size of the icon.
   *
   * Remember to keep the size relative to the text or content it is near.
   */
  size: IconSize;
  /**
   * The message to show in the question icons tooltip.
   */
  title: React.ReactNode;
  className?: string;
  color?: SVGIconProps['color'];
  hoverAnimation?: boolean;
}

function InfoTooltip({title, size, color, className, ...tooltipProps}: InfoTooltipProps) {
  return (
    <InfoIconContainer size={size} className={className}>
      <Tooltip title={title} {...tooltipProps}>
        <IconInfo
          size={size}
          color={color ?? 'subText'}
          data-test-id="more-information"
        />
      </Tooltip>
    </InfoIconContainer>
  );
}

const InfoIconContainer = styled('span')<
  Pick<InfoTooltipProps, 'size' | 'className' | 'hoverAnimation'>
>`
  display: inline-block;
  height: ${p => p.theme.iconSizes[p.size]};
  line-height: ${p => p.theme.iconSizes[p.size]};

  ${p =>
    p.hoverAnimation &&
    `
    & svg {
      transition: 120ms opacity;
      opacity: 0.6;

      &:hover {
        opacity: 1;
      }
    }
    `}
`;

export default InfoTooltip;
