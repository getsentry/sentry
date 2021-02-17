import React from 'react';
import styled from '@emotion/styled';

import {SectionHeading} from 'app/components/charts/styles';
import QuestionTooltip from 'app/components/questionTooltip';
import Tag, {Background} from 'app/components/tag';
import {IconEllipsis} from 'app/icons';
import space from 'app/styles/space';

type MetaDataProps = {
  headingText: string;
  tooltipText: string;
  bodyText: React.ReactNode;
  subtext: React.ReactNode;
};

export function MetaData({headingText, tooltipText, bodyText, subtext}: MetaDataProps) {
  return (
    <HeaderInfo>
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
    </HeaderInfo>
  );
}

const HeaderInfo = styled('div')`
  &:last-child {
    justify-self: flex-end;
    min-width: 325px;
  }
`;

const StyledSectionHeading = styled(SectionHeading)`
  margin-top: 0;
`;

const SectionBody = styled('div')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.headerFontSize};
  margin-bottom: ${space(0.5)};
`;

const SectionSubtext = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
`;

export const EventNode = styled(Tag)<{pad?: 'left' | 'right'}>`
  & ${/* sc-selector */ Background} {
    border: 1px solid ${p => p.theme.gray500};
  }
`;

export const TraceConnector = styled('div')`
  width: ${space(1)};
  border-top: 1px solid ${p => p.theme.gray500};
`;

export const QuickTraceContainer = styled('div')`
  display: flex;
  align-items: center;
`;

export const StyledIconEllipsis = styled(IconEllipsis)`
  vertical-align: middle;
  margin-bottom: 2px;
`;
