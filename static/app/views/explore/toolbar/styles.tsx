import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {space} from 'sentry/styles/space';

export const ToolbarSection = styled('div')`
  margin-bottom: ${space(2)};
`;

export const ToolbarHeader = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: ${space(0.5)};
`;

export const ToolbarLabel = styled('h6')<{disabled?: boolean}>`
  color: ${p => (p.disabled ? p.theme.gray300 : p.theme.gray500)};
  height: ${p => p.theme.form.md.height};
  min-height: ${p => p.theme.form.md.minHeight};
  font-size: ${p => p.theme.form.md.fontSize};
  text-decoration: underline dotted
    ${p => (p.disabled ? p.theme.gray300 : p.theme.gray300)};
  margin: 0;
`;

export const ToolbarHeaderButton = styled(Button)<{disabled?: boolean}>`
  color: ${p => (p.disabled ? p.theme.gray300 : p.theme.gray500)};
`;

export const ToolbarFooterButton = styled(Button)<{disabled?: boolean}>`
  color: ${p => (p.disabled ? p.theme.gray300 : p.theme.linkColor)};
`;

export const ToolbarFooter = styled('div')<{disabled?: boolean}>`
  margin: ${space(0.5)} 0;
`;

export const ToolbarRow = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: ${space(0.5)};
  margin-bottom: ${space(0.5)};
`;
