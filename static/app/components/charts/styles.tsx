import styled from '@emotion/styled';

import {Flex, Grid, type FlexProps, type GridProps} from '@sentry/scraps/layout';

export const SectionHeading = styled('h4')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${p => p.theme.space.md};
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  margin: ${p => p.theme.space.md} 0;
`;

export const SectionValue = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  margin-right: ${p => p.theme.space.md};
`;

export function InlineContainer(props: GridProps) {
  return (
    <Grid
      align="center"
      flow={{zero: 'row', xl: 'column'}}
      gap={{zero: '0', xl: '0 md'}}
      {...props}
    />
  );
}

export function ChartControls(props: FlexProps) {
  return (
    <Flex
      direction={{zero: 'column', xl: 'row'}}
      justify={{zero: 'start', xl: 'between'}}
      wrap={{zero: 'nowrap', xl: 'wrap'}}
      padding="md"
      paddingLeft="2xl"
      borderTop="primary"
      {...props}
    />
  );
}

// Header element for charts within panels.
// @TODO(jonasbadalic) This should be a title component and not a div
export const HeaderTitle = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${p => p.theme.space.md};

  color: ${p => p.theme.tokens.content.primary};
  align-items: center;

  /* @TODO(jonasbadalic) This should be a title component and not a div */
  font-size: 1rem;
  font-weight: ${p => p.theme.font.weight.sans.medium};
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
  gap: ${p => p.theme.space.md};
  align-items: baseline;
  background-color: ${p => p.theme.tokens.background.primary};
  position: absolute;
  top: 40px;
  z-index: 1;
  font-size: ${p => p.theme.font.size.xl};
`;

export const ChartContainer = styled('div')`
  padding: ${p => p.theme.space.xl} ${p => p.theme.space['2xl']};
`;
