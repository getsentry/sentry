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
   * Decorative 16x16 graphic rendered before the values: an icon from
   * `sentry/icons`, or a `PlatformIcon` for a browser, OS or SDK.
   */
  leadingGraphic?:
    | React.ReactElement<SVGIconProps>
    | React.ReactElement<React.ComponentProps<typeof PlatformIcon>>;
  /**
   * Width of the skeleton shown while loading.
   */
  loadingWidth?: string;
  /**
   * Render the label as text as well. Off by default: the graphic beside the
   * values usually carries it, and a header has no room to name every property.
   */
  showLabel?: boolean;
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

export function EntityHeaderMetadataItem({
  isLoading,
  label,
  leadingGraphic,
  loadingWidth = '120px',
  showLabel,
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
      {leadingGraphic && !isLoading && (
        <Flex align="center" flexShrink={0} aria-hidden>
          {leadingGraphic}
        </Flex>
      )}
      {isLoading ? (
        <Placeholder width={loadingWidth} height={METADATA_TEXT_HEIGHT} />
      ) : (
        <Fragment>
          {/*
            The label is in the DOM either way, so a screen reader reads
            "Browser Chrome 144.0.0" whether or not it is on screen. Showing it
            is then only a question of visibility, not of semantics.
          */}
          {showLabel ? (
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
