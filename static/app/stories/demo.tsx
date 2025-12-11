import React from 'react';
import styled from '@emotion/styled';

export const Demo = styled((props: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...props} data-test-id="storybook-demo" />
))`
  margin-top: ${p => p.theme.space.md};
  margin-bottom: -${p => p.theme.space.xl};
  width: 100%;
  background: ${p => p.theme.tokens.background.secondary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-bottom: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: ${p => p.theme.space.md};
  padding: 64px ${p => p.theme.space.xl};
  min-height: 160px;
  max-height: 512px;
  overflow: auto;
  border-radius: ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0 0;
  box-shadow: inset 0 0 0 1px ${p => p.theme.tokens.background.tertiary};
`;
