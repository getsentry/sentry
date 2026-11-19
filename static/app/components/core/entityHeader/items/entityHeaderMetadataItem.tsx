import {Fragment} from 'react';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import type {SVGIconProps} from '@sentry/icons/svgIcon';
import type {PlatformIcon} from 'platformicons';

import type {UserAvatar} from '@sentry/scraps/avatar';
import {
  METADATA_TEXT_HEIGHT,
  METADATA_TEXT_STYLES,
  METADATA_VALUE_TEXT_STYLES,
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
 * One entry of a list: a text or link value, keyed. A list cannot hold a
 * list.
 */
export type EntityHeaderMetadataListEntry = EntityHeaderMetadataValueProps & {
  /**
   * Keys the entry, and is what `sort` and `filter` usually compare.
   */
  key: string;
};

interface EntityHeaderMetadataListOptions {
  items: EntityHeaderMetadataListEntry[];
  type: 'list';
  /**
   * Keeps entries out of the list entirely. Runs before `sort`.
   */
  filter?: (entry: EntityHeaderMetadataListEntry) => boolean;
  /**
   * Entries past this collapse behind "+N more", which lists them on hover or
   * focus. Omitted or `NaN`, every entry is shown; a negative count shows
   * none. Responsive: plain keys resolve against the header's width,
   * `screen:` keys against the viewport.
   */
  maxVisible?: Responsive<number>;
  /**
   * Orders the entries before they are cut to `maxVisible`, so the ones that
   * matter most stay in view.
   */
  sort?: (a: EntityHeaderMetadataListEntry, b: EntityHeaderMetadataListEntry) => number;
}

type EntityHeaderMetadataListProps = EntityHeaderMetadataItemShared &
  EntityHeaderMetadataListOptions;

/**
 * A list takes no `tooltip`, `secondary` or `variant` of its own: each entry
 * carries its own, and "+N more" owns the list's only tooltip.
 */
export type EntityHeaderMetadataItemProps =
  | EntityHeaderMetadataValueProps
  | EntityHeaderMetadataListProps;

/**
 * The entries a list's `filter` keeps. Independent of `maxVisible`, so the
 * header can drop an emptied list without resolving it.
 */
export function getFilteredEntries({
  items,
  filter,
}: Pick<EntityHeaderMetadataListProps, 'items' | 'filter'>) {
  return filter ? items.filter(filter) : items;
}

/**
 * The pipe that ends a property in the metadata row, drawn inside its item so
 * it wraps with it.
 */
function MetadataDivider() {
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

export function EntityHeaderMetadataItemSkeleton({
  hasTrailingDivider,
}: {
  hasTrailingDivider: boolean;
}) {
  return (
    <Flex
      role="listitem"
      align="center"
      gap="md"
      minWidth={0}
      minHeight={METADATA_TEXT_HEIGHT}
    >
      <Placeholder width="120px" height={METADATA_TEXT_HEIGHT} />
      {hasTrailingDivider && <MetadataDivider />}
    </Flex>
  );
}

function getValueBehavior(
  props: EntityHeaderMetadataValueProps,
  isInteractive: boolean
): EntityHeaderTextBehavior {
  if (!isInteractive) {
    return {type: 'text', variant: props.type === 'text' ? props.variant : undefined};
  }
  return props.type === 'link'
    ? {
        type: 'link',
        ...toLinkDestination(props),
        'aria-label': `${props.label} ${props.value}`,
        tooltip: props.tooltip,
      }
    : {type: 'text', variant: props.variant, tooltip: props.tooltip};
}

function MetadataGraphic({
  graphic,
  isLoading,
}: {
  graphic: EntityHeaderMetadataItemShared['leadingGraphic'];
  isLoading: boolean;
}) {
  return (
    <Flex
      width="16px"
      height={METADATA_TEXT_HEIGHT}
      align="center"
      justify="center"
      flexShrink={0}
      aria-hidden
    >
      {isLoading ? null : graphic}
    </Flex>
  );
}

interface MetadataItemFrameProps {
  children: React.ReactNode;
  isLoading: boolean;
  leadingGraphic: EntityHeaderMetadataItemShared['leadingGraphic'];
  /**
   * Draws the pipe that ends this property in the metadata row.
   */
  hasTrailingDivider?: boolean;
  /**
   * Comes before the graphic: a list's own graphic and label, carried by its
   * first drawn item so they wrap together.
   */
  lead?: React.ReactNode;
  /**
   * Omitted where the frame is not in a list, as in a tooltip.
   */
  role?: 'listitem';
}

// One named list item rather than a `dt`/`dd` pair: as a description list,
// VoiceOver narrated the pairing — "term", "selectable list item", "end of
// term" — before it ever reached the value.
function MetadataItemFrame({
  children,
  isLoading,
  leadingGraphic,
  hasTrailingDivider,
  lead,
  role,
}: MetadataItemFrameProps) {
  return (
    <Flex
      role={role}
      align="center"
      gap="md"
      minWidth={0}
      minHeight={METADATA_TEXT_HEIGHT}
    >
      <Flex align="center" gap="xs" minWidth={0}>
        {lead}
        {leadingGraphic && (
          <MetadataGraphic graphic={leadingGraphic} isLoading={isLoading} />
        )}
        {children}
      </Flex>
      {hasTrailingDivider && <MetadataDivider />}
    </Flex>
  );
}

interface MetadataValueProps {
  /**
   * Off for a copy that is only read, such as a collapsed list entry: a link
   * draws as text and no tooltip is attached, so the copy adds no tab stop.
   */
  isInteractive: boolean;
  value: EntityHeaderMetadataValueProps;
}

function MetadataValue({value: props, isInteractive}: MetadataValueProps) {
  const {label, mode = 'compact', secondary} = props;
  const isLink = isInteractive && props.type === 'link';
  const needsOwnLabel = !isLink || mode === 'full';

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
        behavior={getValueBehavior(props, isInteractive)}
        styles={METADATA_VALUE_TEXT_STYLES}
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
          <VisuallyHidden>{`${label} ${secondary.label}`}</VisuallyHidden>
          {isInteractive ? (
            <InfoText
              title={`${label} ${secondary.label}`}
              variant="muted"
              {...METADATA_TEXT_STYLES}
            >
              {secondary.value}
            </InfoText>
          ) : (
            <Text variant="muted" {...METADATA_TEXT_STYLES}>
              {secondary.value}
            </Text>
          )}
        </Fragment>
      )}
    </Fragment>
  );
}

interface MetadataEntryProps {
  entry: EntityHeaderMetadataListEntry;
  isInteractive: boolean;
  /**
   * Set on a list's last visible element when the list is not the row's last
   * property.
   */
  hasTrailingDivider?: boolean;
  /**
   * Set on a list's first visible entry, which starts the property: it
   * carries the list's graphic and label.
   */
  lead?: React.ReactNode;
  role?: 'listitem';
}

function MetadataEntry({
  entry,
  hasTrailingDivider,
  isInteractive,
  lead,
  role,
}: MetadataEntryProps) {
  const {key: _key, ...value} = entry;
  return (
    <MetadataItemFrame
      isLoading={false}
      leadingGraphic={value.leadingGraphic}
      hasTrailingDivider={hasTrailingDivider}
      lead={lead}
      role={role}
    >
      <MetadataValue value={value} isInteractive={isInteractive} />
    </MetadataItemFrame>
  );
}

function MetadataList({
  items,
  filter,
  sort,
  maxVisible,
  label,
  leadingGraphic,
  hasTrailingDivider,
  mode = 'compact',
}: EntityHeaderMetadataListProps & {hasTrailingDivider: boolean}) {
  const {t} = useTranslation();
  const responsiveMaxVisible = useResponsivePropValue(maxVisible);
  const resolvedMaxVisible =
    responsiveMaxVisible === undefined || Number.isNaN(responsiveMaxVisible)
      ? undefined
      : Math.max(0, responsiveMaxVisible);

  const filtered = getFilteredEntries({items, filter});
  const sorted = sort ? filtered.toSorted(sort) : filtered;
  const visible = sorted.slice(0, resolvedMaxVisible);
  const hidden = resolvedMaxVisible === undefined ? [] : sorted.slice(resolvedMaxVisible);

  // The list's graphic and label travel with its first drawn item, so they
  // wrap with it: the first entry, or "+N more" when every entry collapses.
  const lead = (
    <Fragment>
      {leadingGraphic && <MetadataGraphic graphic={leadingGraphic} isLoading={false} />}
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
        {visible.map((entry, index) => (
          <MetadataEntry
            key={entry.key}
            entry={entry}
            isInteractive
            lead={index === 0 ? lead : undefined}
            hasTrailingDivider={
              hasTrailingDivider && hidden.length === 0 && index === visible.length - 1
            }
            role="listitem"
          />
        ))}
        {/*
          Collapsed entries stay in the list, so a screen reader hears every
          entry, and "+N more" is the list's last item. Read-only, so they add
          no tab stop that cannot be seen.
        */}
        {hidden.map(entry => (
          <VisuallyHidden key={entry.key} role="listitem">
            <MetadataEntry entry={entry} isInteractive={false} />
          </VisuallyHidden>
        ))}
        {/*
          An item of its own, read after every entry, and wrapping with them.
        */}
        {hidden.length > 0 && (
          <MetadataItemFrame
            isLoading={false}
            leadingGraphic={undefined}
            hasTrailingDivider={hasTrailingDivider}
            lead={visible.length === 0 ? lead : undefined}
            role="listitem"
          >
            <InfoText
              {...METADATA_TEXT_STYLES}
              variant="muted"
              title={
                <Flex wrap="wrap" gap="sm md" paddingTop="xs" paddingBottom="xs">
                  {hidden.map(entry => (
                    <MetadataEntry key={entry.key} entry={entry} isInteractive={false} />
                  ))}
                </Flex>
              }
            >
              {t('+%s more', hidden.length)}
            </InfoText>
          </MetadataItemFrame>
        )}
      </Container>
    </Container>
  );
}

export function EntityHeaderMetadataItem({
  hasTrailingDivider,
  isLoading = false,
  ...props
}: EntityHeaderMetadataItemProps & {hasTrailingDivider: boolean; isLoading?: boolean}) {
  if (isLoading) {
    return (
      <MetadataItemFrame
        isLoading
        leadingGraphic={props.leadingGraphic}
        hasTrailingDivider={hasTrailingDivider}
        role="listitem"
      >
        <Placeholder width="120px" height={METADATA_TEXT_HEIGHT} />
      </MetadataItemFrame>
    );
  }

  if (props.type === 'list') {
    return <MetadataList {...props} hasTrailingDivider={hasTrailingDivider} />;
  }

  return (
    <MetadataItemFrame
      isLoading={false}
      leadingGraphic={props.leadingGraphic}
      hasTrailingDivider={hasTrailingDivider}
      role="listitem"
    >
      <MetadataValue value={props} isInteractive />
    </MetadataItemFrame>
  );
}
