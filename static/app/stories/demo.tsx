import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const Demo = styled('div')`
  margin-top: 8px;
  margin-bottom: -16px;
  width: 100%;
  background: ${p => p.theme.tokens.background.secondary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-bottom: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: ${space(1)};
  padding: 64px 16px;
  min-height: 160px;
  max-height: 512px;
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  box-shadow: inset 0 0 0 1px ${p => p.theme.tokens.background.tertiary};
`;
