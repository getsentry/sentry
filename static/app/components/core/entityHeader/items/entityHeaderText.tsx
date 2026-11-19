import {InfoText} from '@sentry/scraps/info';
import type {LinkDestination} from '@sentry/scraps/link';
import {ExternalLink, Link} from '@sentry/scraps/link';
import type {TextProps} from '@sentry/scraps/text';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

/**
 * Narrower than `ContentVariant`, because a tooltipped value also colours its
 * underline and `Tooltip` takes a smaller set. `muted` stands in for
 * `secondary`; left out are `accent`, which would read as a link, and
 * `promotion`.
 */
export type EntityHeaderTextVariant =
  | 'primary'
  | 'muted'
  | 'danger'
  | 'success'
  | 'warning';

/**
 * The typography header text takes from the item it belongs to. Style
 * constants should `satisfies` this, so a style the text would not apply
 * fails to type-check rather than being dropped.
 */
export type EntityHeaderTextStyles = Pick<
  TextProps<'span'>,
  'bold' | 'density' | 'size' | 'tabular' | 'wrap'
>;

/**
 * How a run of header text behaves: whether it navigates, and whether it
 * explains. Only text takes a colour, since a link is always accent, so its
 * colour says it navigates. Only a link takes a name of its own.
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
 * Takes the destination from something that carries one among other fields,
 * so a title, stat half or metadata item hands over where it leads and
 * nothing else.
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
 * One link for every destination the header takes: `to` routes inside the
 * product, `externalHref` opens outside it in a new tab. The two draw the
 * same, so the choice is about where the destination lives, not how it looks.
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

interface EntityHeaderTextProps {
  behavior: EntityHeaderTextBehavior;
  children: React.ReactNode;
  styles: EntityHeaderTextStyles;
}

/**
 * A run of header text that may navigate and may explain. A link is accent,
 * a tooltip adds an underline, and one that does both is both.
 */
export function EntityHeaderText({behavior, children, styles}: EntityHeaderTextProps) {
  if (behavior.type === 'link') {
    return (
      <Text {...styles} variant="accent">
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
      <InfoText title={behavior.tooltip} variant={behavior.variant} {...styles}>
        {children}
      </InfoText>
    );
  }

  return (
    <Text variant={behavior.variant} {...styles}>
      {children}
    </Text>
  );
}
