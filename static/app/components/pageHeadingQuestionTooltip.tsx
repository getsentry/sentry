import styled from '@emotion/styled';

import QuestionTooltip from 'sentry/components/questionTooltip';
import space from 'sentry/styles/space';

type PageHeadingQuestionTooltipProps = Omit<
  React.ComponentProps<typeof QuestionTooltip>,
  'size'
>;

export function PageHeadingQuestionTooltip(props: PageHeadingQuestionTooltipProps) {
  return <StyledQuestionTooltip isHoverable position="right" size="sm" {...props} />;
}

const StyledQuestionTooltip = styled(QuestionTooltip)`
  margin-left: ${space(1)};
`;
