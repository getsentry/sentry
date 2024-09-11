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
`;

export const ToolbarHeading = styled('h6')<{disabled?: boolean}>`
  color: ${p => (p.disabled ? p.theme.gray300 : p.theme.purple300)};
  height: ${p => p.theme.form.md.height};
  min-height: ${p => p.theme.form.md.minHeight};
  font-size: ${p => p.theme.form.md.fontSize};
  line-height: ${p => p.theme.form.md.lineHeight};
  text-decoration: underline dotted
    ${p => (p.disabled ? p.theme.gray300 : p.theme.purple300)};
  margin: 0 0 ${space(1)} 0;
`;

export const ToolbarHeaderButton = styled(Button)<{disabled?: boolean}>`
  color: ${p => (p.disabled ? p.theme.gray300 : p.theme.purple300)};
`;

export const ToolbarFooterButton = styled(Button)<{disabled?: boolean}>`
  color: ${p => p.theme.gray300};
`;

export const ToolbarFooter = styled('div')<{disabled?: boolean}>`
  margin-top: ${space(0.5)};
`;

export const ToolbarRow = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(0.5)};

  :not(:first-child) {
    padding-top: ${space(1)};
  }
`;
