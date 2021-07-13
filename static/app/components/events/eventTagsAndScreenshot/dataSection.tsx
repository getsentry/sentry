import styled from '@emotion/styled';
import kebabCase from 'lodash/kebabCase';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import EventDataSection, {SectionContents} from 'app/components/events/eventDataSection';
import QuestionTooltip from 'app/components/questionTooltip';
import space from 'app/styles/space';

type Props = {
  title: string;
  description: string;
  children: React.ReactNode;
};

function DataSection({title, description, children}: Props) {
  const type = kebabCase(title);
  return (
    <StyledEventDataSection
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
    >
      {children}
    </StyledEventDataSection>
  );
}

export default DataSection;

const TitleWrapper = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  grid-gap: ${space(0.5)};
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

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    && {
      padding: 0;
      border: 0;
    }
  }
`;
