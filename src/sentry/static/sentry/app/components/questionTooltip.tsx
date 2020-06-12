import React from 'react';
import styled from '@emotion/styled';

import {IconSize} from 'app/utils/theme';
import Tooltip from 'app/components/tooltip';
import {IconQuestion} from 'app/icons';

type ContainerProps = {
  className?: string;
  size: IconSize | string;
};

const QuestionIconContainer = styled('span')<ContainerProps>`
  display: inline-block;
  height: ${p => p.theme.iconSizes[p.size] ?? p.size};
  line-height: ${p => p.theme.iconSizes[p.size] ?? p.size};

  & svg {
    transition: 120ms color;
    color: ${p => p.theme.gray400};

    &:hover {
      color: ${p => p.theme.gray500};
    }
  }
`;

type QuestionProps = {
  className?: string;
  title: React.ReactNode;
  size: string;
} & Pick<React.ComponentProps<typeof Tooltip>, 'position'> &
  Partial<Pick<React.ComponentProps<typeof Tooltip>, 'containerDisplayMode'>>;

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
