import {Fragment} from 'react';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import type {SVGIconProps} from '@sentry/icons/svgIcon';
import type {PlatformIcon} from 'platformicons';
import type {DistributedOmit} from 'type-fest';

import type {UserAvatar} from '@sentry/scraps/avatar';
import {
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
   * Entries past this collapse behind "+N more", which lists them on hover or
   * focus. Omitted, every entry is shown. Responsive: plain keys resolve
   * against the header's width, `screen:` keys against the viewport.
   */
  maxVisible?: Responsive<number>;
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
  /**
   * Omitted where the frame is not in a list, as in a tooltip.
   */
  role?: 'listitem';
  /**
   * Drawn after the content: the pipe that ends a property in the row.
   */
  trailing?: React.ReactNode;
}

// One named list item rather than a `dt`/`dd` pair: as a description list,
// VoiceOver narrated the pairing — "term", "selectable list item", "end of
// term" — before it ever reached the value.
function MetadataItemFrame({children, role, trailing}: MetadataItemFrameProps) {
  return (
    <Flex
      role={role}
      align="center"
      gap="md"
      minWidth={0}
      minHeight={METADATA_TEXT_HEIGHT}
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
    <MetadataItemFrame role="listitem" trailing={trailing}>
      {hasGraphic && <MetadataGraphic />}
      <Placeholder width="120px" height={METADATA_TEXT_HEIGHT} />
    </MetadataItemFrame>
  );
}

interface MetadataValueProps {
  value: MetadataValueData;
  /**
   * Draws a copy that is only read, such as a collapsed entry's: a link draws
   * as text and no tooltip is drawn, so the copy adds no tab stop.
   */
  readOnly?: boolean;
}

function MetadataValue({value: props, readOnly = false}: MetadataValueProps) {
  const {label, mode = 'compact', secondary} = props;
  const isLink = props.type === 'link' && !readOnly;
  // A link names itself from `label`; text needs the label beside it.
  const needsOwnLabel = Boolean(label) && (!isLink || mode === 'full');
  const behavior: EntityHeaderTextBehavior = readOnly
    ? {type: 'text', variant: props.type === 'text' ? props.variant : undefined}
    : props.type === 'link'
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
          <InfoText
            title={readOnly ? null : secondaryLabel}
            variant="muted"
            {...METADATA_TEXT_STYLES}
          >
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
  /**
   * Draws a read-only copy, for a collapsed entry.
   */
  readOnly?: boolean;
  role?: 'listitem';
  trailing?: React.ReactNode;
}

function MetadataEntry({entry, lead, readOnly, role, trailing}: MetadataEntryProps) {
  return (
    <MetadataItemFrame role={role} trailing={trailing}>
      {lead}
      {entry.leadingGraphic && <MetadataGraphic>{entry.leadingGraphic}</MetadataGraphic>}
      <MetadataValue value={entry} readOnly={readOnly} />
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
  const visible = items.slice(0, cut);
  const hidden = items.slice(cut);

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
        {visible.map((entry, index) => (
          <MetadataEntry
            key={entry.key}
            entry={entry}
            lead={index === 0 ? lead : undefined}
            trailing={
              hidden.length === 0 && index === visible.length - 1 ? trailing : undefined
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
            <MetadataEntry entry={entry} readOnly />
          </VisuallyHidden>
        ))}
        {/*
          An item of its own, read after every entry, and wrapping with them.
        */}
        {hidden.length > 0 && (
          <MetadataItemFrame role="listitem" trailing={trailing}>
            {visible.length === 0 && lead}
            <InfoText
              {...METADATA_TEXT_STYLES}
              variant="muted"
              title={
                <Flex wrap="wrap" gap="sm md" paddingTop="xs" paddingBottom="xs">
                  {hidden.map(entry => (
                    <MetadataEntry key={entry.key} entry={entry} readOnly />
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

  return <MetadataEntry entry={props} role="listitem" trailing={trailing} />;
}
