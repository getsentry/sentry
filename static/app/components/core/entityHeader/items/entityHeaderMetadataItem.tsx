import {Fragment, useCallback, useRef, useState} from 'react';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import type {SVGIconProps} from '@sentry/icons/svgIcon';
import type {PlatformIcon} from 'platformicons';
import type {DistributedOmit} from 'type-fest';

import type {UserAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {DateTime, parseDate} from '@sentry/scraps/dateTime';
import {
  METADATA_ROW_HEIGHT,
  METADATA_TEXT_HEIGHT,
  METADATA_TEXT_STYLES,
} from '@sentry/scraps/entityHeader/constants';
import {InfoText} from '@sentry/scraps/info';
import type {Responsive} from '@sentry/scraps/layout';
import {Container, Flex, Grid, useResponsivePropValue} from '@sentry/scraps/layout';
import type {LinkDestination} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';

import {Placeholder} from 'sentry/components/placeholder';
import {TimeSince} from 'sentry/components/timeSince';

import type {
  EntityHeaderTextBehavior,
  EntityHeaderTextTypography,
  EntityHeaderTextVariant,
} from './entityHeaderText';
import {EntityHeaderText, toLinkDestination} from './entityHeaderText';

interface EntityHeaderMetadataItemShared {
  /**
   * What the property is, such as "Started at" or "Browser". Assistive
   * technology always gets it, as hidden text, in a link's name or as a list's
   * name, so a value is never announced without its key. `mode` decides
   * whether it is visible.
   */
  label: string;
  /**
   * A 16px graphic before the value. Always decorative, so it is hidden from
   * assistive technology. It takes a node rather than data, because a
   * property can be about anything.
   */
  leadingGraphic?:
    | React.ReactElement<SVGIconProps>
    | React.ReactElement<React.ComponentProps<typeof PlatformIcon>>
    | React.ReactElement<React.ComponentProps<typeof UserAvatar>>;
  /**
   * `compact` keeps `label` for screen readers only, and leaves the graphic
   * beside the value to identify the property. `full` also draws `label`.
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
  secondary?: {label: string; value: string};
  /**
   * Explains the value on hover or focus. The value is underlined when it has
   * one.
   */
  tooltip?: React.ReactNode;
}

type EntityHeaderMetadataValueProps = EntityHeaderMetadataItemShared &
  (
    | (EntityHeaderMetadataValueQualifiers & {
        type: 'text';
        /**
         * A string rather than a node, so the header draws every value the same
         * way.
         */
        value: string;
        /**
         * Colors the value to call out a problem or a state.
         */
        variant?: EntityHeaderTextVariant;
      })
    | {
        /**
         * A date, drawn in the header's one format rather than formatted by
         * the caller. A missing or unparseable `date` is an empty value.
         */
        date: string | Date;
        type: 'date';
        /**
         * - `absolute`: "Jun 8, 2025 9:05:09 PM PDT", following the viewer's 12
         *   or 24 hour preference.
         * - `relative`: "5min ago", with the absolute time in every timezone in
         *   its tooltip, headed by the item's `label`.
         *
         * @default 'absolute'
         */
        format?: 'absolute' | 'relative';
        // Typed as `never` so an object declared before it is passed, which
        // skips the excess property check, cannot include them.
        secondary?: never;
        tooltip?: never;
        value?: never;
        variant?: never;
      }
    | (EntityHeaderMetadataValueQualifiers & {
        type: 'link';
        /**
         * A string rather than a node, because the link's name combines
         * `label` and `value`, so a links list reads "Release 8.42.0".
         */
        value: string;
      } & LinkDestination)
  );

/**
 * A text, date or link value with an optional `label`, as used by list
 * entries.
 */
type MetadataValueData = DistributedOmit<EntityHeaderMetadataValueProps, 'label'> & {
  /**
   * Optional, because the list's label can already explain an entry, such as
   * a tool under "Tools". Without a label, a link is named by its value alone.
   */
  label?: string;
};

/**
 * One entry of a list: a text, date or link value, keyed. A list cannot hold a
 * list.
 */
export type EntityHeaderMetadataListEntry = MetadataValueData & {key: string};

interface EntityHeaderMetadataListOptions {
  /**
   * Shown in the order passed. `maxVisible` keeps the first entries, so
   * filter and sort them before passing them.
   */
  items: EntityHeaderMetadataListEntry[];
  type: 'list';
  /**
   * Entries past this count collapse behind "+N more", which reveals them in
   * place. When omitted, every entry is shown. Plain responsive keys resolve
   * against the header's width, and `screen:` keys against the viewport.
   */
  maxVisible?: Responsive<number>;
}

type EntityHeaderMetadataListProps = EntityHeaderMetadataItemShared &
  EntityHeaderMetadataListOptions;

/**
 * A list takes no `tooltip`, `secondary` or `variant`. Each entry sets its
 * own.
 */
export type EntityHeaderMetadataItemProps =
  | EntityHeaderMetadataValueProps
  | EntityHeaderMetadataListProps;

/**
 * A value that renders. Its text is not blank, its `secondary` has a
 * non-blank value or is absent, and a date is already parsed, so renderers
 * don't check or parse it again.
 */
type ResolvedMetadataValue =
  | Exclude<MetadataValueData, {type: 'date'}>
  | (Omit<Extract<MetadataValueData, {type: 'date'}>, 'date'> & {date: Date});

type ResolvedMetadataListProps = Omit<EntityHeaderMetadataListProps, 'items'> & {
  items: Array<ResolvedMetadataValue & {key: string}>;
};

export type ResolvedMetadataItem = ResolvedMetadataValue | ResolvedMetadataListProps;

// The types say `string`, but data mapped from an API can still put a node or
// `null` here, and `.trim()` would throw on it.
function isDrawableValue(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * An empty value usually comes from mapping over data with a missing name, and
 * is left out like a `null` item. A date is parsed with the same parser both
 * date renderers use. A date it cannot read is left out rather than drawn as
 * "Invalid date", and the renderers draw the parsed date.
 */
function resolveMetadataValue(entry: MetadataValueData): ResolvedMetadataValue | null {
  if (entry.type === 'date') {
    const parsed = parseDate(entry.date, 'UTC');
    return parsed === null ? null : {...entry, date: new Date(parsed.epochMilliseconds)};
  }
  if (!isDrawableValue(entry.value)) {
    return null;
  }
  if (entry.secondary && !isDrawableValue(entry.secondary.value)) {
    return {...entry, secondary: undefined};
  }
  return entry;
}

/**
 * Returns the item as it renders, or `null` if it renders nothing. A list
 * keeps only the entries that render, and renders nothing when none do.
 */
export function resolveMetadataItem(
  item: EntityHeaderMetadataItemProps
): ResolvedMetadataItem | null {
  if (item.type !== 'list') {
    return resolveMetadataValue(item);
  }
  const items = item.items.flatMap(entry => {
    const resolved = resolveMetadataValue(entry);
    return resolved ? [{...resolved, key: entry.key}] : [];
  });
  return items.length > 0 ? {...item, items} : null;
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
   * Drawn after the content, such as the pipe that ends a property in the row.
   */
  trailing?: React.ReactNode;
}

// A list item rather than a `dt`/`dd` pair. As a description list, VoiceOver
// read "term", "selectable list item" and "end of term" before it reached the
// value.
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

const VALUE_STYLES = {
  size: 'md',
  density: 'comfortable',
  ellipsis: true,
} as const satisfies EntityHeaderTextTypography;

interface MetadataRelativeDateProps {
  date: Date;
  label?: string;
}

// The render prop puts the value's styles on `TimeSince`'s own trigger, so it
// truncates without a clipping wrapper cutting off its focus ring.
function MetadataRelativeDate({date, label}: MetadataRelativeDateProps) {
  return (
    <Text {...VALUE_STYLES}>
      {textProps => (
        <TimeSince
          {...textProps}
          date={date}
          unitStyle="short"
          tooltipShowSeconds
          tooltipPrefix={label}
        />
      )}
    </Text>
  );
}

function MetadataDisplayValue({value: props}: {value: ResolvedMetadataValue}) {
  if (props.type === 'date') {
    return props.format === 'relative' ? (
      <MetadataRelativeDate date={props.date} label={props.label} />
    ) : (
      <EntityHeaderText {...VALUE_STYLES} behavior={{type: 'text'}}>
        <DateTime date={props.date} year="always" precision="second" showTimezone />
      </EntityHeaderText>
    );
  }
  const behavior: EntityHeaderTextBehavior =
    props.type === 'link'
      ? {
          type: 'link',
          ...toLinkDestination(props),
          'aria-label': props.label ? `${props.label} ${props.value}` : undefined,
          tooltip: props.tooltip,
        }
      : {type: 'text', variant: props.variant, tooltip: props.tooltip};
  return (
    <EntityHeaderText {...VALUE_STYLES} behavior={behavior}>
      {props.value}
    </EntityHeaderText>
  );
}

function MetadataValue({value: props}: {value: ResolvedMetadataValue}) {
  const {label, mode = 'compact', secondary} = props;
  // A link's name already includes `label`, so a compact link draws no
  // separate label. Text and dates always need one.
  const needsOwnLabel = Boolean(label) && (props.type !== 'link' || mode === 'full');
  const secondaryLabel = secondary
    ? label
      ? `${label} ${secondary.label}`
      : secondary.label
    : undefined;

  return (
    <Fragment>
      {needsOwnLabel &&
        (mode === 'full' ? (
          <InfoText
            mode="overflowOnly"
            title={label}
            variant="muted"
            size="md"
            density="comfortable"
          >
            {label}
          </InfoText>
        ) : (
          <VisuallyHidden>{label}</VisuallyHidden>
        ))}
      <MetadataDisplayValue value={props} />
      {secondary && (
        <Fragment>
          {/*
            The composed key is real text and not only the tooltip's,
            because a tooltip reaches assistive technology through
            `aria-describedby`, which is not announced on focus.
          */}
          <VisuallyHidden>{secondaryLabel}</VisuallyHidden>
          <InfoText
            title={secondaryLabel}
            variant="muted"
            size="md"
            density="comfortable"
            ellipsis
          >
            {secondary.value}
          </InfoText>
        </Fragment>
      )}
    </Fragment>
  );
}

interface MetadataEntryProps {
  entry: ResolvedMetadataValue;
  /**
   * Set on a list's first visible entry, which carries the list's graphic and
   * label. The graphic keeps its fixed box, and the label shares the remaining
   * space with the entry's text.
   */
  leadGraphic?: React.ReactNode;
  leadLabel?: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
  tabIndex?: number;
  trailing?: React.ReactNode;
}

function MetadataEntry({
  entry,
  leadGraphic,
  leadLabel,
  ref,
  tabIndex,
  trailing,
}: MetadataEntryProps) {
  return (
    <MetadataItemFrame ref={ref} tabIndex={tabIndex} trailing={trailing}>
      {leadGraphic}
      {entry.leadingGraphic && <MetadataGraphic>{entry.leadingGraphic}</MetadataGraphic>}
      {/*
        Each text part takes its natural width while there is room. In a
        narrow header the long parts share what is left equally and truncate,
        so short ones stay whole and the pipe follows the text that shows.
      */}
      <Grid
        flow="column"
        autoColumns="minmax(0, max-content)"
        gap="xs"
        align="center"
        minWidth={0}
      >
        {leadLabel}
        <MetadataValue value={entry} />
      </Grid>
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
}: ResolvedMetadataListProps & {trailing: React.ReactNode}) {
  const {t} = useTranslation();
  const cut = useResponsivePropValue(maxVisible) ?? items.length;
  // The index of the first hidden entry when "+N more" was pressed, or null
  // while collapsed. Stored rather than read from `cut`, so a later resize
  // doesn't collapse the list again or move focus.
  const [revealedFrom, setRevealedFrom] = useState<number | null>(null);
  // Set by the click that reveals the rest and cleared by the first focus, so
  // a later change to `items` that moves another entry to `revealedFrom`
  // cannot move focus back into the header.
  const pendingFocusRef = useRef(false);
  const focusIfPending = useCallback((element: HTMLElement | null) => {
    if (element && pendingFocusRef.current) {
      pendingFocusRef.current = false;
      element.focus();
    }
  }, []);
  const isCollapsed = revealedFrom === null && cut < items.length;
  const shown = isCollapsed ? items.slice(0, cut) : items;

  // The list's graphic and label render inside its first item, so they wrap
  // with it. That item is the first entry, or "+N more" when every entry is
  // collapsed.
  const leadGraphic = leadingGraphic ? (
    <MetadataGraphic>{leadingGraphic}</MetadataGraphic>
  ) : undefined;
  // Hidden from assistive technology, because the nested list's name already
  // includes the label.
  const leadLabel =
    mode === 'full' ? (
      <Text size="md" density="comfortable" ellipsis variant="muted" aria-hidden>
        {label}
      </Text>
    ) : undefined;
  const lead = (
    <Fragment>
      {leadGraphic}
      {leadLabel}
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
            leadGraphic={index === 0 ? leadGraphic : undefined}
            leadLabel={index === 0 ? leadLabel : undefined}
            trailing={!isCollapsed && index === shown.length - 1 ? trailing : undefined}
            // "+N more" unmounts as it reveals the rest, so focus moves to
            // the first revealed entry rather than resetting to the page.
            ref={index === revealedFrom ? focusIfPending : undefined}
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
              onClick={() => {
                pendingFocusRef.current = true;
                setRevealedFrom(cut);
              }}
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

export function EntityHeaderMetadataItem({
  trailing,
  ...props
}: ResolvedMetadataItem & {trailing: React.ReactNode}) {
  if (props.type === 'list') {
    return <MetadataList {...props} trailing={trailing} />;
  }

  return <MetadataEntry entry={props} trailing={trailing} />;
}
