import styled from '@emotion/styled';
import kebabCase from 'lodash/kebabCase';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import EventDataSection, {
  SectionContents,
} from 'sentry/components/events/eventDataSection';
import QuestionTooltip from 'sentry/components/questionTooltip';
import space from 'sentry/styles/space';

type Props = {
  children: React.ReactNode;
  description: string;
  title: string;
  className?: string;
};

function DataSection({title, description, children, className, ...props}: Props) {
  const type = kebabCase(title);
  return (
    <StyledEventDataSection
      {...props}
      className={className}
      type={type}
      title={
        <TitleWrapper>
          <GuideAnchor target={type} position="bottom">
            <Title>{title}</Title>
          </GuideAnchor>
          <QuestionTooltip size="xs" position="top" title={description} />
        </TitleWrapper>
      }
      wrapTitle={false}
      showPermalink={false}
    >
      {children}
    </StyledEventDataSection>
  );
}

export default DataSection;

const TitleWrapper = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  gap: ${space(0.5)};
  align-items: center;
  padding: ${space(0.75)} 0;
`;

const Title = styled('h3')`
  margin-bottom: 0;
  padding: 0 !important;
  height: 14px;
`;

const StyledEventDataSection = styled(EventDataSection)`
  ${SectionContents} {
    flex: 1;
  }
`;
