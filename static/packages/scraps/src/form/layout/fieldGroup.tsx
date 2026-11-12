import type * as React from 'react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';
import {PanelProvider} from '@sentry/scraps/panelProvider';

export function FieldGroup({
  title,
  children,
  hasButtons,
}: {
  children: React.ReactNode;
  hasButtons?: boolean;
  title?: React.ReactNode;
}) {
  return (
    <Panel>
      <PanelProvider>
        {title ? <PanelHeader hasButtons={hasButtons}>{title}</PanelHeader> : null}
        <PanelBody>{children}</PanelBody>
      </PanelProvider>
    </Panel>
  );
}

// Matches the app's `Panel` and `PanelHeader`, which Scraps cannot import.
const Panel = styled('div')`
  background: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  margin-bottom: ${p => p.theme.space.xl};
  position: relative;
`;

const PanelHeader = styled('div')<{hasButtons?: boolean}>`
  display: flex;
  align-items: center;
  justify-content: space-between;

  /* Do not apply text styles to overlay elements such as dropdowns */
  > *:not(:has([data-overlay], button, a[role='button']), button, a[role='button']),
  &:not(:has(> *)) {
    color: ${p => p.theme.tokens.content.primary};
    font-size: ${p => p.theme.font.size.sm};
    font-weight: ${p => p.theme.font.weight.sans.medium};
    text-transform: uppercase;
    line-height: 1;
  }

  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: calc(${p => p.theme.radius.md} + 1px)
    calc(${p => p.theme.radius.md} + 1px) 0 0;
  background: ${p => p.theme.tokens.background.secondary};
  position: relative;
  padding: ${p => (p.hasButtons ? p.theme.space.md : p.theme.space.xl)}
    ${p => p.theme.space.xl};
`;

const PanelBody = styled(Container)`
  > * {
    padding: ${p => p.theme.space.xl};
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};

    &:last-child {
      border-bottom: none;
    }
  }
`;
