import React from 'react';
import styled from '@emotion/styled';

import {SectionHeading} from 'app/components/charts/styles';
import QuestionTooltip from 'app/components/questionTooltip';
import Tag, {Background} from 'app/components/tag';
import space from 'app/styles/space';

type MetaDataProps = {
  headingText: string;
  tooltipText: string;
  bodyText: React.ReactNode;
  subtext: React.ReactNode;
};

export function MetaData({headingText, tooltipText, bodyText, subtext}: MetaDataProps) {
  return (
    <Container>
      <StyledSectionHeading>
        {headingText}
        <QuestionTooltip
          position="top"
          size="sm"
          containerDisplayMode="block"
          title={tooltipText}
        />
      </StyledSectionHeading>
      <SectionBody>{bodyText}</SectionBody>
      <SectionSubtext>{subtext}</SectionSubtext>
    </Container>
  );
}

const Container = styled('div')`
  min-width: 150px;
`;

const StyledSectionHeading = styled(SectionHeading)`
  color: ${p => p.theme.textColor};
`;

const SectionBody = styled('p')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.headerFontSize};
  margin-bottom: ${space(1)};
`;

const SectionSubtext = styled('div')`
  color: ${p => p.theme.subText};
`;

export const EventNode = styled(Tag)<{pad?: 'left' | 'right'}>`
  & ${/* sc-selector */ Background} {
    border: 1px solid ${p => p.theme.gray500};
    height: 24px;
    border-radius: 24px;
  }
`;

export const Dash = styled('div')`
  display: inline-block;
  height: 24px;
  width: ${space(1)};
  border-bottom: 1px solid ${p => p.theme.gray500};
  transform: translateY(-${space(0.5)});
`;
