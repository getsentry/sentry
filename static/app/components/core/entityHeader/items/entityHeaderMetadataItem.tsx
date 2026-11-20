import {Fragment, useState} from 'react';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import type {SVGIconProps} from '@sentry/icons/svgIcon';
import type {PlatformIcon} from 'platformicons';
import type {DistributedOmit} from 'type-fest';

import type {UserAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {
  METADATA_ROW_HEIGHT,
  METADATA_TEXT_HEIGHT,
  METADATA_TEXT_STYLES,
} from '@sentry/scraps/entityHeader/constants';
import {InfoText} from '@sentry/scraps/info';
import type {Responsive} from '@sentry/scraps/layout';
import {Container, Flex, useResponsivePropValue} from '@sentry/scraps/layout';
import type {LinkDestination} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';

import {Placeholder} from 'sentry/components/placeholder';

import type {EntityHeaderTextBehavior, EntityHeaderTextVariant} from './entityHeaderText';
import {EntityHeaderText, toLinkDestination} from './entityHeaderText';

interface EntityHeaderMetadataItemShared {
  /**
   * What the property is — "Started at", "Browser". Always exposed to
   * assistive technology, as text, in a link's name or as a list's name, so
   * the value is never announced unexplained; `mode` decides whether it is
   * drawn.
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
}

interface EntityHeaderMetadataValueQualifiers {
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

type EntityHeaderMetadataValueProps = EntityHeaderMetadataItemShared &
  EntityHeaderMetadataValueQualifiers &
  (
    | {
        type: 'text';
        value: React.ReactNode;
        /**
         * Colours the value, to call out a problem or a state.
         */
        variant?: EntityHeaderTextVariant;
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

/**
 * A text or link value whose `label` may be left out, as a list's entries
 * may be.
 */
type MetadataValueData = DistributedOmit<EntityHeaderMetadataValueProps, 'label'> & {
  /**
   * Optional here: an entry the list's own label already explains, such as a
   * tool under "Tools", need not repeat it. Without one, a link is named by
   * its value alone.
   */
  label?: string;
};

/**
 * One entry of a list: a text or link value, keyed. A list cannot hold a
 * list.
 */
export type EntityHeaderMetadataListEntry = MetadataValueData & {
  key: string;
};

interface EntityHeaderMetadataListOptions {
  /**
   * Shown in this order, so filter and sort them before passing them: the
   * cut to `maxVisible` keeps the first ones.
   */
  items: EntityHeaderMetadataListEntry[];
  type: 'list';
  /**
   * Entries past this collapse behind "+N more", which reveals them in place.
   * Omitted, every entry is shown. Responsive: plain keys resolve
   * against the header's width, `screen:` keys against the viewport.
   */
  maxVisible?: Responsive<number>;
}

type EntityHeaderMetadataListProps = EntityHeaderMetadataItemShared &
  EntityHeaderMetadataListOptions;

/**
 * A list takes no `tooltip`, `secondary` or `variant` of its own: each entry
 * carries its own.
 */
export type EntityHeaderMetadataItemProps =
  | EntityHeaderMetadataValueProps
  | EntityHeaderMetadataListProps;

/**
 * Whether the item draws anything. An empty list draws nothing.
 */
export function hasMetadataContent(item: EntityHeaderMetadataItemProps) {
  return item.type !== 'list' || item.items.length > 0;
}

/**
 * The pipe that ends a property in the metadata row, drawn inside its item so
 * it wraps with it.
 */
export function MetadataDivider() {
  return (
    <Container
      width="1px"
      height="14px"
      flexShrink={0}
      borderLeft="primary"
      aria-hidden
      data-test-id="metadata-divider"
    />
  );
}

/**
 * A 16px box for a leading graphic. Left empty while loading, so the box keeps
 * its width.
 */
function MetadataGraphic({children}: {children?: React.ReactNode}) {
  return (
    <Flex
      width="16px"
      height={METADATA_TEXT_HEIGHT}
      align="center"
      justify="center"
      flexShrink={0}
      aria-hidden
    >
      {children}
    </Flex>
  );
}

interface MetadataItemFrameProps {
  children: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
  tabIndex?: number;
  /**
   * Drawn after the content: the pipe that ends a property in the row.
   */
  trailing?: React.ReactNode;
}

// One named list item rather than a `dt`/`dd` pair: as a description list,
// VoiceOver narrated the pairing — "term", "selectable list item", "end of
// term" — before it ever reached the value.
function MetadataItemFrame({children, ref, tabIndex, trailing}: MetadataItemFrameProps) {
  return (
    <Flex
      ref={ref}
      role="listitem"
      tabIndex={tabIndex}
      align="center"
      gap="md"
      minWidth={0}
      minHeight={METADATA_ROW_HEIGHT}
    >
      <Flex align="center" gap="xs" minWidth={0}>
        {children}
      </Flex>
      {trailing}
    </Flex>
  );
}

export function EntityHeaderMetadataItemSkeleton({
  hasGraphic = false,
  trailing,
}: {
  trailing: React.ReactNode;
  /**
   * Keeps an empty box where the graphic will be, so the item keeps its width.
   */
  hasGraphic?: boolean;
}) {
  return (
    <MetadataItemFrame trailing={trailing}>
      {hasGraphic && <MetadataGraphic />}
      <Placeholder width="120px" height={METADATA_TEXT_HEIGHT} />
    </MetadataItemFrame>
  );
}

function MetadataValue({value: props}: {value: MetadataValueData}) {
  const {label, mode = 'compact', secondary} = props;
  const isLink = props.type === 'link';
  // A link names itself from `label`; text needs the label beside it.
  const needsOwnLabel = Boolean(label) && (!isLink || mode === 'full');
  const behavior: EntityHeaderTextBehavior =
    props.type === 'link'
      ? {
          type: 'link',
          ...toLinkDestination(props),
          'aria-label': label ? `${label} ${props.value}` : undefined,
          tooltip: props.tooltip,
        }
      : {type: 'text', variant: props.variant, tooltip: props.tooltip};
  const secondaryLabel = secondary
    ? label
      ? `${label} ${secondary.label}`
      : secondary.label
    : undefined;

  return (
    <Fragment>
      {needsOwnLabel &&
        (mode === 'full' ? (
          <Text {...METADATA_TEXT_STYLES} variant="muted">
            {label}
          </Text>
        ) : (
          <VisuallyHidden>{label}</VisuallyHidden>
        ))}
      <EntityHeaderText
        behavior={behavior}
        // Truncates rather than overflowing its item, so the pipe after it
        // follows the text a narrow header shows.
        styles={{size: 'md', density: 'comfortable', ellipsis: true}}
      >
        {props.value}
      </EntityHeaderText>
      {secondary && (
        <Fragment>
          {/*
            The composed key is real text and not only the tooltip's,
            because a tooltip reaches assistive technology through
            `aria-describedby`, which is not announced on focus.
          */}
          <VisuallyHidden>{secondaryLabel}</VisuallyHidden>
          <InfoText title={secondaryLabel} variant="muted" {...METADATA_TEXT_STYLES}>
            {secondary.value}
          </InfoText>
        </Fragment>
      )}
    </Fragment>
  );
}

interface MetadataEntryProps {
  entry: MetadataValueData;
  /**
   * Set on a list's first visible entry, which starts the property: it
   * carries the list's graphic and label.
   */
  lead?: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
  tabIndex?: number;
  trailing?: React.ReactNode;
}

function MetadataEntry({entry, lead, ref, tabIndex, trailing}: MetadataEntryProps) {
  return (
    <MetadataItemFrame ref={ref} tabIndex={tabIndex} trailing={trailing}>
      {lead}
      {entry.leadingGraphic && <MetadataGraphic>{entry.leadingGraphic}</MetadataGraphic>}
      <MetadataValue value={entry} />
    </MetadataItemFrame>
  );
}

function MetadataList({
  items,
  maxVisible,
  label,
  leadingGraphic,
  trailing,
  mode = 'compact',
}: EntityHeaderMetadataListProps & {trailing: React.ReactNode}) {
  const {t} = useTranslation();
  const cut = useResponsivePropValue(maxVisible) ?? items.length;
  // Where the list was cut when "+N more" was pressed; null while collapsed.
  // Kept rather than re-read from `cut`, so a later resize neither collapses
  // the list again nor moves focus.
  const [revealedFrom, setRevealedFrom] = useState<number | null>(null);
  const isCollapsed = revealedFrom === null && cut < items.length;
  const shown = isCollapsed ? items.slice(0, cut) : items;

  // The list's graphic and label travel with its first drawn item, so they
  // wrap with it: the first entry, or "+N more" when every entry collapses.
  const lead = (
    <Fragment>
      {leadingGraphic && <MetadataGraphic>{leadingGraphic}</MetadataGraphic>}
      {/* The nested list's name already speaks the label. */}
      {mode === 'full' && (
        <Text {...METADATA_TEXT_STYLES} variant="muted" aria-hidden>
          {label}
        </Text>
      )}
    </Fragment>
  );

  return (
    // Both wrappers drop out of layout, so each entry is an item of the
    // metadata row and wraps with it, while the list stays in the
    // accessibility tree.
    <Container role="listitem" display="contents">
      <Container role="list" aria-label={label} display="contents">
        {shown.map((entry, index) => (
          <MetadataEntry
            key={entry.key}
            entry={entry}
            lead={index === 0 ? lead : undefined}
            trailing={!isCollapsed && index === shown.length - 1 ? trailing : undefined}
            // "+N more" unmounts as it reveals the rest, so focus moves to
            // the first revealed entry rather than falling to the page.
            ref={index === revealedFrom ? focusOnMount : undefined}
            tabIndex={index === revealedFrom ? -1 : undefined}
          />
        ))}
        {/*
          A button rather than a `Disclosure`, which lays out its own row and
          so cannot sit inline in the wrapping metadata row.
        */}
        {isCollapsed && (
          <MetadataItemFrame trailing={trailing}>
            {shown.length === 0 && lead}
            <Button
              variant="transparent"
              size="zero"
              aria-expanded={false}
              onClick={() => setRevealedFrom(cut)}
            >
              <Text {...METADATA_TEXT_STYLES} variant="inherit">
                {t('+%s more', items.length - cut)}
              </Text>
            </Button>
          </MetadataItemFrame>
        )}
      </Container>
    </Container>
  );
}

function focusOnMount(element: HTMLElement | null) {
  element?.focus();
}

export function EntityHeaderMetadataItem({
  trailing,
  isLoading = false,
  ...props
}: EntityHeaderMetadataItemProps & {trailing: React.ReactNode; isLoading?: boolean}) {
  if (isLoading) {
    return (
      <EntityHeaderMetadataItemSkeleton
        hasGraphic={Boolean(props.leadingGraphic)}
        trailing={trailing}
      />
    );
  }

  if (props.type === 'list') {
    return <MetadataList {...props} trailing={trailing} />;
  }

  return <MetadataEntry entry={props} trailing={trailing} />;
}
