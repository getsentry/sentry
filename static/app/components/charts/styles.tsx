import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

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
  gap: ${space(1)};
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(1)} 0;
`;

export const SectionValue = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  margin-right: ${space(1)};
`;

export const InlineContainer = styled('div')`
  display: grid;
  align-items: center;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-auto-flow: column;
    grid-column-gap: ${space(1)};
  }
`;

export const ChartControls = styled('div')`
  padding: ${space(1)} ${space(1)} ${space(1)} ${space(3)};
  border-top: 1px solid ${p => p.theme.border};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
  }
`;

// Header element for charts within panels.
export const HeaderTitle = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  ${p => p.theme.text.cardTitle};
  color: ${p => p.theme.headingColor};
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

// Used for rendering total value of a chart right below the HeaderTitleLegend
export const HeaderValue = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: baseline;
  background-color: ${p => p.theme.background};
  position: absolute;
  top: 40px;
  z-index: 1;
  font-size: ${p => p.theme.headerFontSize};
`;

export const ChartContainer = styled('div')`
  padding: ${space(2)} ${space(3)};
`;
