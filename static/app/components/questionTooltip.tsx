import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';
import {IconQuestion} from 'sentry/icons';
import {IconSize} from 'sentry/utils/theme';

type ContainerProps = {
  size: IconSize | string;
  className?: string;
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
  size: string;
  title: React.ReactNode;
  className?: string;
} & Pick<React.ComponentProps<typeof Tooltip>, 'position'> &
  Partial<
    Pick<
      React.ComponentProps<typeof Tooltip>,
      'containerDisplayMode' | 'isHoverable' | 'overlayStyle'
    >
  >;

function QuestionTooltip({title, size, className, ...tooltipProps}: QuestionProps) {
  return (
    <QuestionIconContainer size={size} className={className}>
      <Tooltip title={title} {...tooltipProps}>
        <IconQuestion size={size} data-test-id="more-information" />
      </Tooltip>
    </QuestionIconContainer>
  );
}
export default QuestionTooltip;
