import styled from '@emotion/styled';

import {t} from 'sentry/locale';

/**
 * The leading column of an activity line: the marker, plus anything that sits
 * beside it in the same gutter (an actor avatar, say).
 *
 * It is a grid of fixed 22px cells so every row's marker lands on the same
 * vertical axis — which is what lets the connecting line drawn by
 * `ActivityLineRow` pass through all of them.
 */
export const ActivityLineLeadingCells = styled('div')`
  position: relative;
  z-index: 1;
  grid-column: 1;
  grid-row: 1;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 22px;
  gap: ${p => p.theme.space.xs};

  @container activity-list (min-width: 90px) {
    gap: ${p => p.theme.space.sm};
  }
`;

/** One 22px slot in the leading column, with its contents centred on the line. */
export const ActivityLineMarkerCell = styled('div')`
  display: grid;
  place-items: center;
  min-width: 22px;
  min-height: 22px;
  margin-top: -2px;
`;

/**
 * The circle an icon marker sits in. Opaque, so it masks the connecting line
 * running behind it rather than letting it cross the glyph.
 */
export const ActivityLineIconFrame = styled('span')`
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid ${p => p.theme.tokens.border.transparent.neutral.muted};
  border-radius: 100%;
  background: ${p => p.theme.tokens.background.primary};
`;

/**
 * How loud a dot marker is. `vibrant` picks out the one step or event the line
 * is currently at; everything else stays `moderate`.
 */
export type ActivityLineDotVariant = 'moderate' | 'vibrant';

interface ActivityLineDotProps {
  label?: string;
  /** Overrides the 8px default; the progress marker draws a larger dot. */
  size?: number;
  variant?: ActivityLineDotVariant;
}

/**
 * The plain marker: an event on the line that is not a milestone. The ring of
 * page background around it is what breaks the connecting line behind the dot.
 */
export const ActivityLineDotGraphic = styled('span', {
  // Neither is a meaningful attribute on a span, and `size` is valid enough
  // HTML to reach the DOM if it is not filtered here.
  shouldForwardProp: prop => prop !== 'size' && prop !== 'variant',
})<{
  size?: number;
  variant?: ActivityLineDotVariant;
}>`
  width: ${p => p.size ?? 8}px;
  height: ${p => p.size ?? 8}px;
  border-radius: 100%;
  background: ${p =>
    p.variant === 'vibrant'
      ? p.theme.tokens.graphics.neutral.vibrant
      : p.theme.tokens.graphics.neutral.moderate};
  /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
  box-shadow: 0 0 0 4px ${p => p.theme.tokens.background.primary};
`;

export function ActivityLineDot({label, size, variant}: ActivityLineDotProps) {
  return (
    <ActivityLineDotGraphic
      size={size}
      variant={variant}
      aria-label={label ?? t('Activity update')}
      role="img"
    />
  );
}

/** A leading column carrying nothing but a plain dot. */
export function ActivityLineDotMarker({label, variant}: ActivityLineDotProps) {
  return (
    <ActivityLineLeadingCells>
      <ActivityLineMarkerCell>
        <ActivityLineDot label={label} variant={variant} />
      </ActivityLineMarkerCell>
    </ActivityLineLeadingCells>
  );
}
