import React from 'react';
import styled from '@emotion/styled';

import {SectionHeading} from 'app/components/charts/styles';
import QuestionTooltip from 'app/components/questionTooltip';
import Tag, {Background, Text} from 'app/components/tag';
import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';

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

export const NodesContainer = styled('div')`
  position: absolute;
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 33px;
  gap: ${space(1)};

  &:before {
    content: '';
    border-bottom: 1px solid ${p => p.theme.gray500};
    height: 33px;
    position: absolute;
    width: 100%;
    transform: translateY(-50%);
    z-index: ${p => p.theme.zIndex.initial};
  }
`;

export const EventNode = styled(Tag)<{type: keyof Theme['tag']}>`
  z-index: ${p => p.theme.zIndex.initial};

  & ${/* sc-selector */ Background} {
    border: 1px solid ${p => p.theme.gray500};
    height: 24px;
  }

  & ${/* sc-selector */ Text} {
    color: ${p => (p.type === 'black' ? p.theme.white : p.theme.gray500)};
  }
`;
