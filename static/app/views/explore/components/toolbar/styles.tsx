import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button, type ButtonProps} from '@sentry/scraps/button';
import {Flex, type FlexProps} from '@sentry/scraps/layout';

export const ToolbarSection = styled('div')`
  margin-bottom: ${p => p.theme.space['2xl']};
`;

export function ToolbarHeader(props: FlexProps<'div'>) {
  return <Flex justify="between" align="baseline" marginBottom="sm" {...props} />;
}

export const ToolbarLabel = styled('h6')<{disabled?: boolean}>`
  color: ${p => (p.disabled ? p.theme.tokens.content.disabled : p.theme.colors.gray800)};
  font-size: ${p => p.theme.form.md.fontSize};
  margin: 0;
  text-decoration: underline;
  text-decoration-style: dotted;
`;

export const ToolbarFooterButton = styled(Button)<{
  disabled?: boolean;
  priority?: ButtonProps['priority'];
}>`
  ${p =>
    p.priority === 'link'
      ? css`
          color: ${p.disabled
            ? p.theme.tokens.content.disabled
            : p.theme.tokens.interactive.link.accent.rest};
        `
      : ''}
`;

export const ToolbarFooter = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${p => p.theme.space.md};

  :not(:last-child) {
    margin-bottom: ${p => p.theme.space.xs};
  }
`;

export const ToolbarRow = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: ${p => p.theme.space.md};

  :not(:last-child) {
    margin-bottom: ${p => p.theme.space.xs};
  }
`;
