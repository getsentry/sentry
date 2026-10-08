import {Fragment} from 'react';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import type {PlatformIcon} from 'platformicons';

import {METADATA_TEXT_HEIGHT} from '@sentry/scraps/entityHeader/constants';
import {InfoText} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import type {SVGIconProps} from 'sentry/icons/svgIcon';

/**
 * The variants a metadata item can take. Narrower than `ContentVariant`, so
 * that a tooltipped item's underline can use the same list.
 */
type EntityHeaderMetadataVariant = 'primary' | 'muted' | 'danger' | 'success' | 'warning';

export interface EntityHeaderMetadataItemProps {
  /**
   * What the values are — "Browser", "Started at". Required, and read before
   * them by assistive technology. Same meaning as a stat's or the title's
   * `label`.
   */
  label: string;
  /**
   * The values themselves, rendered together. One item is one property, which
   * may take more than one value to express: a browser is its name *and* its
   * version, which is two values rather than one string the caller joined.
   *
   * At least one. An item with none would announce a label and then nothing,
   * which reads as a property whose value failed to load.
   */
  values: [React.ReactNode, ...React.ReactNode[]];
  /**
   * Decorative graphic rendered before the values: an icon from
   * `sentry/icons`, or a `PlatformIcon` for a browser, OS or SDK. Drawn in a
   * fixed 16x16 box, which is held through loading so the row does not
   * narrow as items resolve.
   */
  leadingGraphic?:
    | React.ReactElement<SVGIconProps>
    | React.ReactElement<React.ComponentProps<typeof PlatformIcon>>;
  /**
   * How much of the property to draw.
   *
   * `compact` renders the values alone and leaves naming them to the graphic
   * beside them, because a header has no room to spell out every property.
   * `full` draws the label as text in front of them.
   *
   * The label is in the DOM either way and read by assistive technology, so
   * this decides what is on screen, not what is announced.
   *
   * @default 'compact'
   */
  mode?: 'compact' | 'full';
  /**
   * Shown on hover, with a dotted underline to signal it. Use to expand an
   * abbreviation or explain a term.
   */
  tooltip?: React.ReactNode;
  /**
   * Defaults to `muted`. Use a semantic variant to call out a problem.
   */
  variant?: EntityHeaderMetadataVariant;
}

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

export function EntityHeaderMetadataItem({
  isLoading,
  label,
  leadingGraphic,
  mode = 'compact',
  tooltip,
  values,
  variant = 'muted',
}: EntityHeaderMetadataItemProps & {isLoading?: boolean}) {
  const textStyles = {
    size: 'md',
    density: 'comfortable',
    wrap: 'nowrap',
  } as const;

  // Rendered as one run, so a screen reader reads "Chrome 144.0.0" rather than
  // two fragments. The name comes from this content rather than an `aria-label`
  // the way the title's does, because a value can be an element — a formatted
  // timestamp, say — and an element cannot be concatenated into a string.
  const valueContent = values.map((value, index) => (
    <Fragment key={index}>
      {index > 0 ? ' ' : null}
      {value}
    </Fragment>
  ));

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
          {/*
            The label is in the DOM either way, so a screen reader reads
            "Browser Chrome 144.0.0" whether or not it is on screen. Showing it
            is then only a question of visibility, not of semantics.
          */}
          {mode === 'full' ? (
            <Text {...textStyles} variant="muted">
              {label}
            </Text>
          ) : (
            <VisuallyHidden>{label}</VisuallyHidden>
          )}
          {tooltip ? (
            <InfoText title={tooltip} variant={variant} {...textStyles}>
              {valueContent}
            </InfoText>
          ) : (
            <Text variant={variant} {...textStyles}>
              {valueContent}
            </Text>
          )}
        </Fragment>
      )}
    </Flex>
  );
}
