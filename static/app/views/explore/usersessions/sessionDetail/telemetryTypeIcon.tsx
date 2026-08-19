import {IconFire, IconGraph, IconList, IconMegaphone, IconSpan} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import type {SessionDatasetKey} from 'sentry/views/explore/usersessions/datasets';

interface Props extends SVGIconProps {
  type: SessionDatasetKey;
}

/**
 * The glyph for a telemetry type, shared by the scrubber's lane labels and the
 * rail's row markers.
 *
 * The rail leans on the icon to say *what* a row is, and that is what frees the
 * row's color to say how bad the row is instead. It only works while the two
 * surfaces agree on the glyph, so both take it from here rather than keeping
 * their own map.
 */
export function TelemetryTypeIcon({type, ...props}: Props) {
  switch (type) {
    case 'errors':
      return <IconFire {...props} />;
    case 'traces':
      return <IconSpan {...props} />;
    case 'logs':
      return <IconList {...props} />;
    case 'metrics':
      return <IconGraph type="line" {...props} />;
    case 'feedback':
      return <IconMegaphone {...props} />;
  }
}
