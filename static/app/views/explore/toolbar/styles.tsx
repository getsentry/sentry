import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';

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

export const ToolbarLabel = styled('h6')<{disabled?: boolean; underlined?: boolean}>`
  color: ${p => (p.disabled ? p.theme.gray300 : p.theme.gray500)};
  height: ${p => p.theme.form.md.height};
  min-height: ${p => p.theme.form.md.minHeight};
  font-size: ${p => p.theme.form.md.fontSize};
  margin: 0;
  ${p =>
    !defined(p.underlined) || p.underlined
      ? `text-decoration: underline dotted ${p.disabled ? p.theme.gray300 : p.theme.gray300}`
      : ''};
`;

export const ToolbarHeaderButton = styled(Button)<{disabled?: boolean}>`
  color: ${p => (p.disabled ? p.theme.gray300 : p.theme.gray500)};
`;

export const ToolbarFooterButton = styled(Button)<{disabled?: boolean}>`
  color: ${p => (p.disabled ? p.theme.gray300 : p.theme.linkColor)};
`;

export const ToolbarFooter = styled('div')<{disabled?: boolean}>`
  :not(:last-child) {
    margin-bottom: ${space(0.5)};
  }
`;

export const ToolbarRow = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: ${space(0.5)};

  :not(:last-child) {
    margin-bottom: ${space(0.5)};
  }
`;
