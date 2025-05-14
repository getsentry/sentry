import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const Container = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  justify-content: flex-start;
  background-color: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.translucentBorder};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1.5)};

  @media (max-width: ${p => p.theme.breakpoints.large}) {
    width: fit-content;
  }
`;
