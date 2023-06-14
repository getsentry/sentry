import styled from '@emotion/styled';

import {Tooltip, TooltipProps} from 'sentry/components/tooltip';
import {IconQuestion} from 'sentry/icons';
import type {IconSize} from 'sentry/utils/theme';

interface QuestionProps
  extends Partial<
    Pick<
      TooltipProps,
      'containerDisplayMode' | 'isHoverable' | 'overlayStyle' | 'position'
    >
  > {
  /**
   * Set's the size of the icon.
   *
   * Remember to keep the size relative to the text or content it is near.
   */
  size: IconSize;
  /**
   * The message to show in the question icons tooltip
   */
  title: React.ReactNode;
  className?: string;
}

function QuestionTooltip({title, size, className, ...tooltipProps}: QuestionProps) {
  return (
    <QuestionIconContainer size={size} className={className}>
      <Tooltip title={title} {...tooltipProps}>
        <IconQuestion size={size} color="subText" data-test-id="more-information" />
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
