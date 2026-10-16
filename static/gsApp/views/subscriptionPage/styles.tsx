import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Grid, type GridProps} from '@sentry/scraps/layout';

import {PanelBody} from 'sentry/components/panels/panelBody';

const StyledSubscriptionBody = styled(PanelBody)`
  h3 {
    margin-bottom: ${p => p.theme.space.md};
    font-size: ${p => p.theme.font.size.xl};
    font-weight: 400;
  }
`;

export function SubscriptionBody({children}: {children: ReactNode}) {
  return (
    <Grid
      flow={{zero: 'row', xl: 'column'}}
      autoColumns={{zero: '1fr', xl: 'auto'}}
      justify="between"
      gap={{zero: 'md', xl: '3xl'}}
    >
      {containerProps => (
        <StyledSubscriptionBody withPadding {...containerProps}>
          {children}
        </StyledSubscriptionBody>
      )}
    </Grid>
  );
}

export const ButtonWrapper = styled((props: GridProps) => (
  <Grid flow="column" align="center" gap="md" {...props} />
))`
  align-self: center;
  justify-self: end;
`;

export const StripedTable = styled('table')`
  width: 100%;
  font-size: ${p => p.theme.font.size.md};
  margin: 0;

  tr:nth-child(2n + 1) td {
    background-color: ${p => p.theme.tokens.background.secondary};
  }
`;

export const AlertStripedTable = styled(StripedTable)`
  text-align: center;
  color: ${p => p.theme.tokens.content.secondary};

  th {
    text-transform: uppercase;
    text-align: center;
    font-size: ${p => p.theme.font.size.sm};
  }

  td:first-child,
  th:first-child {
    text-align: left;
  }

  td:last-child,
  th:last-child {
    text-align: right;
    font-weight: bold;
  }

  td,
  th {
    padding: ${p => p.theme.space.md};
  }
`;

export const PanelBodyWithTable = styled(PanelBody)`
  display: grid;
  gap: ${p => p.theme.space['2xl']};

  @container (min-width: ${p => p.theme.container['4xl']}) {
    grid-template-columns: repeat(2, 1fr);
  }
  @container (max-width: ${p => p.theme.container['4xl']}) {
    grid-auto-flow: row;
  }

  h4 {
    font-weight: 400;
    font-size: ${p => p.theme.font.size.xl};
  }
`;
