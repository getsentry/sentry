import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const DoubleHeaderContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: ${space(2)} ${space(3)} ${space(1)} ${space(3)};
  gap: ${space(3)};
`;

export const ErrorPanel = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;

  flex: 1;
  flex-shrink: 0;
  overflow: hidden;
  height: 200px;
  position: relative;
  border-color: transparent;
  margin-bottom: 0;
`;
