import type {LinkDestination} from '@sentry/scraps/link';
import {ExternalLink, Link} from '@sentry/scraps/link';
import type {TextProps} from '@sentry/scraps/text';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

interface EntityHeaderDestinationLinkProps {
  children: React.ReactNode;
  /**
   * Where the link leads. Only `to` and `externalHref` are read, so a title,
   * stat half or metadata item can be passed as it is.
   */
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

/**
 * The typography a header link takes from the text it stands in for. Style
 * constants that feed one should `satisfies` this, so a style the link would
 * not apply fails to type-check rather than being dropped.
 */
export type EntityHeaderTextStyles = Pick<
  TextProps<'span'>,
  'bold' | 'density' | 'size' | 'tabular' | 'wrap'
>;

interface EntityHeaderTextLinkProps
  extends EntityHeaderDestinationLinkProps, EntityHeaderTextStyles {
  /**
   * Attaches to the link itself rather than wrapping it in `InfoText`, which
   * would put a second tab stop inside the anchor.
   */
  tooltip?: React.ReactNode;
}

/**
 * A run of text that navigates. Always accent — one link treatment across the
 * header — so it takes the text's typography but never its colour. A tooltip
 * adds an underline, which is how the header says a link also explains.
 */
export function EntityHeaderTextLink({
  bold,
  density,
  size,
  tabular,
  tooltip,
  wrap,
  ...linkProps
}: EntityHeaderTextLinkProps) {
  return (
    <Text
      bold={bold}
      density={density}
      size={size}
      tabular={tabular}
      wrap={wrap}
      variant="accent"
    >
      {textProps => {
        const link = <EntityHeaderDestinationLink {...linkProps} {...textProps} />;
        return tooltip ? (
          <Tooltip title={tooltip} skipWrapper showUnderline>
            {link}
          </Tooltip>
        ) : (
          link
        );
      }}
    </Text>
  );
}
