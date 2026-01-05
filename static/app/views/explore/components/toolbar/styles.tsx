import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {space} from 'sentry/styles/space';

export const ToolbarSection = styled('div')`
  margin-bottom: ${space(3)};
`;

export const ToolbarHeader = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: ${p => p.theme.space.sm};
`;

export const ToolbarLabel = styled('h6')<{disabled?: boolean}>`
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.colors.gray800)};
  font-size: ${p => p.theme.form.md.fontSize};
  margin: 0;
  text-decoration: underline;
  text-decoration-style: dotted;
`;

export const ToolbarFooterButton = styled(Button)<{disabled?: boolean}>`
  color: ${p =>
    p.disabled ? p.theme.disabled : p.theme.tokens.interactive.link.accent.rest};
`;

export const ToolbarFooter = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};

  :not(:last-child) {
    margin-bottom: ${space(0.5)};
  }
`;

export const ToolbarRow = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: ${space(1)};

  :not(:last-child) {
    margin-bottom: ${space(0.5)};
  }
`;
