import styled from '@emotion/styled';

import PanelItem from 'sentry/components/panels/panelItem';

export const PanelItemPolicy = styled(PanelItem)`
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 1fr auto;
  }
`;
