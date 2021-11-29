import * as React from 'react';
import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';
import {IconQuestion} from 'sentry/icons';
import {IconSize} from 'sentry/utils/theme';

type ContainerProps = {
  className?: string;
  size: IconSize | string;
};

const QuestionIconContainer = styled('span')<ContainerProps>`
  display: inline-block;
  height: ${p => p.theme.iconSizes[p.size] ?? p.size};
  line-height: ${p => p.theme.iconSizes[p.size] ?? p.size};

  & svg {
    transition: 120ms opacity;
    color: ${p => p.theme.gray300};
    opacity: 0.6;

    &:hover {
      opacity: 1;
    }
  }
`;

type QuestionProps = {
  className?: string;
  title: React.ReactNode;
  size: string;
} & Pick<React.ComponentProps<typeof Tooltip>, 'position'> &
  Partial<
    Pick<
      React.ComponentProps<typeof Tooltip>,
      'containerDisplayMode' | 'isHoverable' | 'popperStyle'
    >
  >;

function QuestionTooltip({title, size, className, ...tooltipProps}: QuestionProps) {
  return (
    <QuestionIconContainer size={size} className={className}>
      <Tooltip title={title} {...tooltipProps}>
        <IconQuestion size={size} />
      </Tooltip>
    </QuestionIconContainer>
  );
}
export default QuestionTooltip;
