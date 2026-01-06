import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import type {ContainerProps} from 'sentry/components/core/layout/container';
import {getBorder, getMargin, getSpacing, rc} from 'sentry/components/core/layout/styles';

export type SeparatorProps = Pick<ContainerProps, 'border' | 'margin' | 'padding'> & {
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
      if (omitSeparatorProps.has(prop as any)) {
        return false;
      }
      return isPropValid(prop);
    },
  }
)<SeparatorProps>`
  width: ${p => (p.orientation === 'horizontal' ? 'auto' : '1px')};
  height: ${p => (p.orientation === 'horizontal' ? '1px' : 'auto')};

  ${p => rc('padding', p.padding, p.theme, getSpacing)};
  ${p => rc('margin', p.margin ?? '0', p.theme, getMargin)};

  flex-shrink: 0;
  align-self: stretch;

  border: none;
  ${p =>
    rc(
      p.orientation === 'horizontal' ? 'border-bottom' : 'border-left',
      p.border ?? 'primary',
      p.theme,
      (...args) => `${getBorder(...args)} !important`
    )};
`;
