import isPropValid from '@emotion/is-prop-valid';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {CSS} from '@sentry/scraps/cssTypes';
import {getSpacing, rc, type Responsive} from '@sentry/scraps/layout';

import type {SpaceSize} from 'sentry/utils/theme';

export interface DescriptionListProps extends React.HTMLAttributes<HTMLDListElement> {
  /**
   * How a row's term and details line up against each other.
   * @default 'baseline'
   */
  align?: Responsive<'start' | 'end' | 'center' | 'baseline' | 'stretch'>;
  /**
   * The column tracks the rows are laid out in. A term and its details are two
   * tracks; a term with more than one details cell needs one track each.
   * @default 'max-content minmax(0, 1fr)'
   */
  columns?: Responsive<CSS['gridTemplateColumns']>;
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
  /**
   * Lay the list out as a full-width table: alternate rows are striped, terms
   * and details split the width evenly, and details sit against the far edge.
   * Each cell stays on one line and truncates. Terms are set in the primary
   * color and details in the secondary color, so `terms` does not apply.
   * @default false
   */
  striped?: boolean;
  /**
   * How terms are set against their details.
   *
   * - `muted` sets them in the secondary color at a regular weight, so the
   *   details are what the eye lands on.
   * - `strong` sets them in the primary color and bold, which is what a bare
   *   `dt` inherits from the global rule in base.less. Lists that already read
   *   that way keep it rather than being restyled.
   *
   * @default 'muted'
   */
  terms?: 'muted' | 'strong';
}

const List = styled('dl', {
  shouldForwardProp: prop =>
    prop !== 'gap' &&
    prop !== 'nowrap' &&
    prop !== 'columns' &&
    prop !== 'align' &&
    prop !== 'terms' &&
    prop !== 'striped' &&
    isPropValid(prop),
})<DescriptionListProps>`
  display: grid;
  ${p =>
    rc(
      'grid-template-columns',
      p.columns ??
        (p.striped ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'max-content minmax(0, 1fr)'),
      p.theme
    )};
  ${p => rc('align-items', p.align ?? (p.striped ? 'stretch' : 'baseline'), p.theme)};
  ${p => rc('gap', p.gap ?? (p.striped ? '0' : 'sm md'), p.theme, getSpacing)};
  margin: 0;
  text-align: left;
  ${p =>
    p.nowrap &&
    css`
      width: max-content;
      white-space: nowrap;
    `}

  ${p =>
    p.striped &&
    css`
      > dt,
      > dd {
        padding: ${p.theme.space.xs} ${p.theme.space.md};
        font-size: ${p.theme.font.size.md};
        line-height: inherit;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      > dt {
        display: flex;
        align-items: center;
        color: ${p.theme.tokens.content.primary};
      }

      > dd {
        text-align: right;
        color: ${p.theme.tokens.content.secondary};
      }

      > dt:nth-of-type(odd),
      > dd:nth-of-type(odd) {
        background-color: ${p.theme.tokens.background.secondary};
      }
    `}

  /*
   * Selects on the element so it beats Term's own class without every term
   * restating it. 700 is not a scraps weight -- it is what these lists already
   * inherit from the global dt rule in base.less, restated here because Term
   * overrides that with the regular weight.
   */
  ${p =>
    p.terms === 'strong' &&
    !p.striped &&
    css`
      > dt {
        color: ${p.theme.tokens.content.primary};
        font-weight: 700;
      }
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
