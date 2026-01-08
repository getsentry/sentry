import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const SectionHeading = styled('h4')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
  margin: ${space(1)} 0;
`;

export const SectionValue = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
  margin-right: ${space(1)};
`;

export const InlineContainer = styled('div')`
  display: grid;
  align-items: center;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-auto-flow: column;
    grid-column-gap: ${space(1)};
  }
`;

export const ChartControls = styled('div')`
  padding: ${space(1)} ${space(1)} ${space(1)} ${space(3)};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
  }
`;

// Header element for charts within panels.
// @TODO(jonasbadalic) This should be a title component and not a div
export const HeaderTitle = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};

  color: ${p => p.theme.tokens.content.primary};
  align-items: center;

  /* @TODO(jonasbadalic) This should be a title component and not a div */
  font-size: 1rem;
  font-weight: ${p => p.theme.fontWeight.bold};
  line-height: 1.2;
`;

// Header element for charts within panels
// This header can be rendered while the chart is still loading
export const HeaderTitleLegend = styled(HeaderTitle)`
  background-color: ${p => p.theme.tokens.background.primary};
  border-bottom-right-radius: ${p => p.theme.radius.md};
  position: absolute;
  z-index: 1;
`;

// Used for rendering total value of a chart right below the HeaderTitleLegend
export const HeaderValue = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: baseline;
  background-color: ${p => p.theme.tokens.background.primary};
  position: absolute;
  top: 40px;
  z-index: 1;
  font-size: ${p => p.theme.fontSize.xl};
`;

export const ChartContainer = styled('div')`
  padding: ${space(2)} ${space(3)};
`;
