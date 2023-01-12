import QuestionTooltip from 'sentry/components/questionTooltip';

type PageHeadingQuestionTooltipProps = Omit<
  React.ComponentProps<typeof QuestionTooltip>,
  'size'
>;

export function PageHeadingQuestionTooltip(props: PageHeadingQuestionTooltipProps) {
  return <QuestionTooltip isHoverable position="right" size="sm" {...props} />;
}
