import styled from '@emotion/styled';

import space from 'app/styles/space';

export const SubHeading = styled('h3')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: normal;
  color: ${p => p.theme.textColor};
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const SectionHeading = styled('h4')`
  display: inline-grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(1)} 0;
  line-height: 1.3;
`;

export const SectionValue = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  margin-right: ${space(1)};
`;

export const InlineContainer = styled('div')`
  display: flex;
  align-items: center;
  margin-right: ${space(2)};

  > h4 {
    margin-right: ${space(1)};
  }

  &:last-child {
    margin-right: 0;
  }
`;

export const ChartControls = styled('div')`
  display: flex;
  justify-content: space-between;
  padding: ${space(1)} ${space(3)};
  border-top: 1px solid ${p => p.theme.border};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    flex-direction: column;

    > ${/* sc-selector */ InlineContainer} + ${/* sc-selector */ InlineContainer} {
      margin-top: ${space(1)};
    }
  }
`;

// Header element for charts within panels.
export const HeaderTitle = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.textColor};
  align-items: center;
`;

// Header element for charts within panels
// This header can be rendered while the chart is still loading
export const HeaderTitleLegend = styled(HeaderTitle)`
  background-color: ${p => p.theme.background};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
  position: absolute;
  z-index: 1;
`;

export const ChartContainer = styled('div')`
  padding: ${space(2)} ${space(3)};
`;
