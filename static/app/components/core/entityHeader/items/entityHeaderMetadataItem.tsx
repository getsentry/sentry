import {Fragment} from 'react';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import type {SVGIconProps} from '@sentry/icons/svgIcon';
import type {PlatformIcon} from 'platformicons';

import type {UserAvatar} from '@sentry/scraps/avatar';
import {METADATA_TEXT_HEIGHT} from '@sentry/scraps/entityHeader/constants';
import {InfoText} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import type {LinkDestination} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';

import {EntityHeaderTextLink} from './entityHeaderLink';

const TEXT_STYLES = {
  size: 'md',
  density: 'comfortable',
  wrap: 'nowrap',
} as const;

interface EntityHeaderMetadataItemBase {
  /**
   * What the property is — "Started at", "Browser". Always exposed to
   * assistive technology, as text or in a link's name, so the value is never
   * announced unexplained; `mode` decides whether it is drawn.
   */
  label: string;
  /**
   * A 16px graphic before the value. Always decorative, so it is hidden from
   * assistive technology. A node rather than data: there is no fixed set of
   * things a property can be about.
   */
  leadingGraphic?:
    | React.ReactElement<SVGIconProps>
    | React.ReactElement<React.ComponentProps<typeof PlatformIcon>>
    | React.ReactElement<React.ComponentProps<typeof UserAvatar>>;
  /**
   * `compact` leaves naming the property to the graphic beside it and keeps
   * `label` for screen readers only; `full` draws it too.
   *
   * @default 'compact'
   */
  mode?: 'compact' | 'full';
  /**
   * A qualifier on the value, such as a browser's version. `label` names the
   * child and composes with the parent's: "version" under "Browser" is read
   * "Browser version". A property needing a third value is two properties.
   */
  secondary?: {
    label: string;
    value: React.ReactNode;
  };
  /**
   * Explains the value on hover or focus, underlined to signal it.
   */
  tooltip?: React.ReactNode;
}

export type EntityHeaderMetadataItemProps = EntityHeaderMetadataItemBase &
  (
    | {
        type: 'text';
        value: React.ReactNode;
        /**
         * Colours the value. Narrower than `ContentVariant`, because a
         * tooltipped value also colours its underline and `Tooltip` takes a
         * smaller set. `muted` stands in for `secondary`; left out are
         * `accent`, which would read as a link, and `promotion`.
         */
        variant?: 'primary' | 'muted' | 'danger' | 'success' | 'warning';
      }
    | ({
        type: 'link';
        /**
         * Text, not a node: the link is named from it and `label` together, so
         * a links list reads "Release 8.42.0".
         */
        value: string;
      } & LinkDestination)
  );

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
      <EntityHeaderTextLink
        {...TEXT_STYLES}
        destination={props}
        aria-label={`${label} ${props.value}`}
        tooltip={tooltip}
      >
        {props.value}
      </EntityHeaderTextLink>
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
  const needsOwnLabel = props.type === 'text' || mode === 'full';

  // One named list item rather than a `dt`/`dd` pair: as a description list,
  // VoiceOver narrated the pairing — "term", "selectable list item", "end of
  // term" — before it ever reached the value.
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
