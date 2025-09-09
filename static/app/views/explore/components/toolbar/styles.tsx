import {css} from '@emotion/react';
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
  margin-bottom: ${p => (p.theme.isChonk ? p.theme.space.sm : p.theme.space.xs)};
`;

export const ToolbarLabel = styled('h6')<{disabled?: boolean}>`
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.gray500)};
  font-size: ${p => p.theme.form.md.fontSize};
  margin: 0;
  text-decoration: underline;
  text-decoration-style: dotted;
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

export const AggregateSelectorRow = styled('div')`
  display: flex;
  flex-wrap: wrap;
  column-gap: ${space(1)};
  row-gap: ${space(0.5)};
  flex: 1;
  ${p =>
    p.theme.isChonk &&
    css`
      align-items: center;
    `};
  margin-bottom: ${space(0.5)};

  /* Fixed width for aggregate select (matches AggregateCompactSelect width) */
  > :first-child {
    flex: 0 0 100px;
    min-width: 100px;
  }

  /* Two parameter selectors per row, growing to fill available space */
  > :not(:first-child) {
    flex: 1 1 calc((100% - 100px - ${space(1)}) / 2);
    min-width: 0;
  }
`;
