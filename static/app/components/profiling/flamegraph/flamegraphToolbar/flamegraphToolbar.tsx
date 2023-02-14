import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

interface FlamegraphToolbarProps {
  children: React.ReactNode;
}

export const FlamegraphToolbar = styled('div')<FlamegraphToolbarProps>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: ${space(1)};
  gap: ${space(1)};
`;
