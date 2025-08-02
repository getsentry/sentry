import styled from '@emotion/styled';

import type {ContainerProps} from 'sentry/components/core/layout/container';
import {rc} from 'sentry/components/core/layout/styles';

export type SeparatorProps = Pick<ContainerProps, 'border'> & {
  orientation: 'horizontal' | 'vertical';
  children?: never;
} & Omit<React.HTMLAttributes<HTMLHRElement>, 'aria-orientation'>;

const omitSeparatorProps = new Set<keyof SeparatorProps>(['border']);

/**
 * We require a wrapper if we want to use the orientation context,
 * otherwise the styling won't work as override needs to come from the parent.
 */
export const Separator = styled(
  ({orientation, ...props}: SeparatorProps) => {
    return <hr aria-orientation={orientation} {...props} />;
  },
  {
    shouldForwardProp: prop => {
      return !omitSeparatorProps.has(prop as any);
    },
  }
)<SeparatorProps>`
  width: ${p => (p.orientation === 'horizontal' ? 'auto' : '1px')};
  height: ${p => (p.orientation === 'horizontal' ? '1px' : 'auto')};

  flex-shrink: 0;
  align-self: stretch;

  margin: 0;
  border: none;
  ${p =>
    rc(
      p.orientation === 'horizontal' ? 'border-bottom' : 'border-left',
      p.border,
      p.theme,
      v => `1px solid ${p.theme.tokens.border[v]} !important`
    )};
`;
