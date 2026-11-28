import type {DistributedPick} from 'type-fest';

import {InfoText} from '@sentry/scraps/info';
import type {LinkDestination} from '@sentry/scraps/link';
import {ExternalLink, Link} from '@sentry/scraps/link';
import type {TextProps} from '@sentry/scraps/text';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

/**
 * Narrower than `ContentVariant`, because a value with a tooltip also colors
 * its underline and `Tooltip` accepts fewer variants. `muted` replaces
 * `secondary`. `accent` is left out because it would look like a link, and
 * `promotion` is left out as well.
 */
export type EntityHeaderTextVariant =
  | 'primary'
  | 'muted'
  | 'danger'
  | 'success'
  | 'warning';

/**
 * The `Text` props that set the typography of header text. Typography
 * constants should use `satisfies` with this type, so a prop the text would
 * not apply fails to type-check instead of being ignored.
 */
export type EntityHeaderTextTypography = DistributedPick<
  TextProps<'span'>,
  'bold' | 'density' | 'ellipsis' | 'size' | 'tabular' | 'wrap'
>;

/**
 * Whether a run of header text is a link and whether it has a tooltip. Only
 * text takes a `variant`, because a link is always accent to show it
 * navigates. Only a link takes an `aria-label`.
 */
export type EntityHeaderTextBehavior = {
  /**
   * Attaches to the link itself rather than wrapping it in `InfoText`, which
   * would put a second tab stop inside the anchor.
   */
  tooltip?: React.ReactNode;
} & (
  | {type: 'text'; variant?: EntityHeaderTextVariant}
  | ({type: 'link'; 'aria-label'?: string; onClick?: () => void} & LinkDestination)
);

/**
 * Picks only the destination fields from a title, stat half or metadata item,
 * so no other props reach the link.
 */
export function toLinkDestination(source: LinkDestination): LinkDestination {
  return source.externalHref === undefined
    ? {to: source.to}
    : {externalHref: source.externalHref};
}

interface EntityHeaderDestinationLinkProps {
  children: React.ReactNode;
  destination: LinkDestination;
  'aria-label'?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * The link for every header destination. `to` routes inside the product, and
 * `externalHref` opens outside it in a new tab. Both look the same, so choose
 * by where the destination is, not by how it looks.
 */
export function EntityHeaderDestinationLink({
  destination,
  ...props
}: EntityHeaderDestinationLinkProps) {
  return destination.externalHref === undefined ? (
    <Link to={destination.to} {...props} />
  ) : (
    <ExternalLink href={destination.externalHref} {...props} />
  );
}

type EntityHeaderTextProps = EntityHeaderTextTypography & {
  behavior: EntityHeaderTextBehavior;
  children: React.ReactNode;
};

/**
 * Header text that can be a link, have a tooltip, or both. A link is accent,
 * and a tooltip adds an underline.
 */
export function EntityHeaderText({
  behavior,
  children,
  ...typography
}: EntityHeaderTextProps) {
  if (behavior.type === 'link') {
    return (
      <Text {...typography} variant="accent">
        {textProps => {
          const link = (
            <EntityHeaderDestinationLink
              destination={toLinkDestination(behavior)}
              aria-label={behavior['aria-label']}
              onClick={behavior.onClick}
              {...textProps}
            >
              {children}
            </EntityHeaderDestinationLink>
          );
          return behavior.tooltip ? (
            <Tooltip title={behavior.tooltip} skipWrapper showUnderline>
              {link}
            </Tooltip>
          ) : (
            link
          );
        }}
      </Text>
    );
  }

  if (behavior.tooltip) {
    return (
      <InfoText {...typography} title={behavior.tooltip} variant={behavior.variant}>
        {children}
      </InfoText>
    );
  }

  return (
    <Text {...typography} variant={behavior.variant}>
      {children}
    </Text>
  );
}
