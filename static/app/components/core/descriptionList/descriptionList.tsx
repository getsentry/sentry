import isPropValid from '@emotion/is-prop-valid';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {getSpacing, rc, type Responsive} from '@sentry/scraps/layout';

import type {SpaceSize} from 'sentry/utils/theme';

export interface DescriptionListProps extends React.HTMLAttributes<HTMLDListElement> {
  /**
   * Row and column gap between terms and their details.
   * @default 'sm md'
   */
  gap?: Responsive<SpaceSize | `${SpaceSize} ${SpaceSize}`>;
  /**
   * Keep every row on one line and size the list to its own content, rather
   * than wrapping to the width it is given. For a list in an overlay that
   * shrink-to-fits, such as a tooltip, this is what makes the overlay grow to
   * fit the rows instead of breaking timestamps and slugs mid-token.
   * @default false
   */
  nowrap?: boolean;
  ref?: React.Ref<HTMLDListElement>;
}

const List = styled('dl', {
  shouldForwardProp: prop => prop !== 'gap' && prop !== 'nowrap' && isPropValid(prop),
})<DescriptionListProps>`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: baseline;
  ${p => rc('gap', p.gap ?? 'sm md', p.theme, getSpacing)};
  margin: 0;
  text-align: left;
  ${p =>
    p.nowrap &&
    css`
      width: max-content;
      white-space: nowrap;
    `}
`;

const Term = styled('dt')`
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: ${p => p.theme.tokens.content.secondary};
  font-weight: ${p => p.theme.font.weight.sans.regular};
`;

const Details = styled('dd')`
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
`;

/**
 * A compact, two-column list of terms and their details, rendered as a
 * semantic `<dl>`. Compose rows with `DescriptionList.Term` and
 * `DescriptionList.Details`.
 */
export const DescriptionList = Object.assign(List, {Term, Details});
