import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';

export const ToolbarSection = styled('div')`
  margin-bottom: ${space(3)};
`;

export const ToolbarHeader = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: ${space(0.5)};
`;

export const ToolbarLabel = styled('h6')<{disabled?: boolean; underlined?: boolean}>`
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.gray500)};
  font-size: ${p => p.theme.form.md.fontSize};
  margin: 0;
  ${p =>
    !defined(p.underlined) || p.underlined
      ? `text-decoration: underline dotted ${p.disabled ? p.theme.disabled : p.theme.gray300}`
      : ''};
`;

export const ToolbarFooterButton = styled(Button)<{disabled?: boolean}>`
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.linkColor)};
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
  ${p =>
    p.theme.isChonk &&
    css`
      align-items: center;
    `};
  gap: ${space(1)};

  :not(:last-child) {
    margin-bottom: ${space(0.5)};
  }
`;
