import styled from '@emotion/styled';

import type {TooltipProps} from 'sentry/components/tooltip';
import {Tooltip} from 'sentry/components/tooltip';
import {IconInfo, IconQuestion} from 'sentry/icons';
import type {IconSize} from 'sentry/utils/theme';

interface QuestionProps
  extends Partial<
    Pick<
      TooltipProps,
      | 'containerDisplayMode'
      | 'isHoverable'
      | 'overlayStyle'
      | 'position'
      | 'skipWrapper'
      | 'delay'
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
  icon?: 'question' | 'info';
}

function QuestionTooltip({
  title,
  size,
  className,
  icon = 'question',
  ...tooltipProps
}: QuestionProps) {
  return (
    <QuestionIconContainer size={size} className={className}>
      <Tooltip title={title} {...tooltipProps}>
        {icon === 'info' ? (
          <IconInfo size={size} color="subText" data-test-id="more-information" />
        ) : (
          <IconQuestion size={size} color="subText" data-test-id="more-information" />
        )}
      </Tooltip>
    </QuestionIconContainer>
  );
}

const QuestionIconContainer = styled('span')<Pick<QuestionProps, 'size' | 'className'>>`
  display: inline-block;
  height: ${p => p.theme.iconSizes[p.size]};
  line-height: ${p => p.theme.iconSizes[p.size]};

  & svg {
    transition: 120ms opacity;
    opacity: 0.6;

    &:hover {
      opacity: 1;
    }
  }
`;

export default QuestionTooltip;
