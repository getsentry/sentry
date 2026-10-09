import {Fragment} from 'react';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import type {SVGIconProps} from '@sentry/icons/svgIcon';
import type {PlatformIcon} from 'platformicons';

import type {UserAvatar} from '@sentry/scraps/avatar';
import {METADATA_TEXT_HEIGHT} from '@sentry/scraps/entityHeader/constants';
import {InfoText} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';

const TEXT_STYLES = {
  size: 'md',
  density: 'comfortable',
  wrap: 'nowrap',
} as const;

interface EntityHeaderMetadataItemBase {
  /**
   * What the property is. With one value this is its key — "Started at". With
   * two it is the parent of both — "Browser", with `secondary.label` naming
   * the child.
   */
  label: string;
  /**
   * Decorative graphic rendered before the value: an icon from
   * `@sentry/icons`, a `PlatformIcon` for a browser, OS or SDK, or a
   * `UserAvatar` for a person. Drawn in a fixed 16x16 box, which is held
   * through loading so the row does not narrow as items resolve.
   *
   * The box sizes itself, not its contents, so draw the graphic at 16 to match
   * it — `size="md"` on an icon, `size="16px"` on a `PlatformIcon`, `size={16}`
   * on an avatar.
   */
  leadingGraphic?:
    | React.ReactElement<SVGIconProps>
    | React.ReactElement<React.ComponentProps<typeof PlatformIcon>>
    | React.ReactElement<React.ComponentProps<typeof UserAvatar>>;
  /**
   * How much of the property to draw.
   *
   * `compact` renders the value alone and leaves naming it to the graphic
   * beside it, because a header has no room to spell out every property.
   * `full` draws the label as text in front of it.
   *
   * The label reaches assistive technology either way, so this decides what is
   * on screen, not what is announced.
   *
   * @default 'compact'
   */
  mode?: 'compact' | 'full';
  /**
   * A qualifier on the value — a version, an ID. Its `label` is the leaf key,
   * composed with the item's: "version" under "Browser" is announced and
   * hovered as "Browser version".
   *
   * Two values at most. A property needing three is two properties.
   */
  secondary?: {
    label: string;
    value: React.ReactNode;
  };
  /**
   * Shown on hover against the value, with a dotted underline to signal it.
   * Takes structured content, so it can carry a summary rather than a phrase.
   */
  tooltip?: React.ReactNode;
}

/**
 * A property declares whether its value navigates, rather than the component
 * inferring it from whether a destination happens to be defined — the same
 * reason a stat does. A value that changed element as its data arrived would
 * move the row.
 *
 * Note the mirror of a stat: there the *label* links, because a link named by
 * a bare count says nothing in a links list. Here the *value* links, because
 * the value is where the user is going.
 */
export type EntityHeaderMetadataItemProps = EntityHeaderMetadataItemBase &
  (
    | {
        type: 'text';
        value: React.ReactNode;
        /**
         * Use a semantic variant to call out a problem, the way Issue Details
         * renders "Unhandled" in `danger`. Text only: a link already spends
         * its colour on saying that it navigates.
         *
         * Narrower than `ContentVariant` because a tooltipped value also
         * colours its underline, and `Tooltip` takes a smaller set. `muted`
         * resolves to `content.secondary`, so only `accent` and `promotion`
         * are out of reach — neither of which a property value wants.
         */
        variant?: 'primary' | 'muted' | 'danger' | 'success' | 'warning';
      }
    | {
        to: LinkProps['to'];
        type: 'link';
        /**
         * Text, not a node, because the link is named from it together with
         * the item's label — "Release 8.42.0" rather than a bare version.
         */
        value: string;
      }
  );

/**
 * A metadata slot the caller declared but whose item has not resolved yet.
 *
 * The row reserves space for every declared slot, so the number of items
 * cannot change as data lands and push the rows below it down.
 */
export function EntityHeaderMetadataItemSkeleton() {
  return (
    <Flex role="listitem" align="center" minWidth={0} minHeight={METADATA_TEXT_HEIGHT}>
      <Placeholder width="120px" height={METADATA_TEXT_HEIGHT} />
    </Flex>
  );
}

function MetadataValue(props: EntityHeaderMetadataItemProps) {
  const {label, tooltip} = props;

  if (props.type === 'link') {
    return (
      <Text {...TEXT_STYLES} variant="accent">
        {styleProps => {
          const link = (
            <Link
              to={props.to}
              // Composed so a links list reads "Release 8.42.0" rather than a
              // bare version. The anchor carries the label's text styles
              // rather than wrapping an element that has them, the way a stat
              // link does.
              aria-label={`${label} ${props.value}`}
              {...styleProps}
            >
              {props.value}
            </Link>
          );
          // Attached to the link rather than wrapping it in InfoText, which
          // would put a second tab stop inside the anchor.
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

  return tooltip ? (
    <InfoText title={tooltip} variant={props.variant} {...TEXT_STYLES}>
      {props.value}
    </InfoText>
  ) : (
    <Text variant={props.variant} {...TEXT_STYLES}>
      {props.value}
    </Text>
  );
}

export function EntityHeaderMetadataItem(
  props: EntityHeaderMetadataItemProps & {isLoading?: boolean}
) {
  const {isLoading, label, leadingGraphic, mode = 'compact', secondary} = props;

  // A link names itself from the label, so rendering the label beside it in
  // compact mode would say the same thing twice. Text cannot, so it keeps its
  // own.
  const needsOwnLabel = props.type === 'text' || mode === 'full';

  return (
    <Flex
      role="listitem"
      align="center"
      gap="xs"
      minWidth={0}
      minHeight={METADATA_TEXT_HEIGHT}
    >
      {leadingGraphic && (
        <Flex
          width="16px"
          height="16px"
          align="center"
          justify="center"
          flexShrink={0}
          aria-hidden
        >
          {isLoading ? null : leadingGraphic}
        </Flex>
      )}
      {isLoading ? (
        <Placeholder width="120px" height={METADATA_TEXT_HEIGHT} />
      ) : (
        <Fragment>
          {needsOwnLabel &&
            (mode === 'full' ? (
              <Text {...TEXT_STYLES} variant="muted">
                {label}
              </Text>
            ) : (
              <VisuallyHidden>{label}</VisuallyHidden>
            ))}
          <MetadataValue {...props} />
          {secondary && (
            <Fragment>
              {/*
                The composed key is real text and not only the tooltip's,
                because a tooltip reaches assistive technology through
                `aria-describedby`, which is not announced on focus.
              */}
              <VisuallyHidden>{`${label} ${secondary.label}`}</VisuallyHidden>
              <InfoText
                title={`${label} ${secondary.label}`}
                variant="muted"
                {...TEXT_STYLES}
              >
                {secondary.value}
              </InfoText>
            </Fragment>
          )}
        </Fragment>
      )}
    </Flex>
  );
}
