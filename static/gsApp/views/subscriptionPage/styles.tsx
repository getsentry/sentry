import styled from '@emotion/styled';

import ButtonBar from 'sentry/components/buttonBar';
import PanelBody from 'sentry/components/panels/panelBody';
import {space} from 'sentry/styles/space';

export const SubscriptionBody = styled(PanelBody)`
  display: grid;
  grid-auto-flow: column;
  justify-content: space-between;
  gap: ${space(4)};

  h3 {
    margin-bottom: ${space(1)};
    font-size: ${p => p.theme.fontSizeExtraLarge};
    font-weight: 400;
  }

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-auto-flow: row;
    grid-auto-columns: 1fr;
    gap: ${space(1)};
  }
`;

export const ButtonWrapper = styled(ButtonBar)`
  align-self: center;
  justify-self: end;
`;

export const StripedTable = styled('table')`
  width: 100%;
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;

  tr:nth-child(2n + 1) td {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

export const AlertStripedTable = styled(StripedTable)`
  text-align: center;
  color: ${p => p.theme.subText};

  th {
    text-transform: uppercase;
    text-align: center;
    font-size: ${p => p.theme.fontSizeSmall};
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
    padding: ${space(1)};
  }
`;

export const PanelBodyWithTable = styled(PanelBody)`
  display: grid;
  gap: ${space(3)};

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (max-width: ${p => p.theme.breakpoints.large}) {
    grid-auto-flow: row;
  }

  h4 {
    font-weight: 400;
    font-size: ${p => p.theme.fontSizeExtraLarge};
  }
`;
