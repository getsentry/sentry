import {t} from 'sentry/locale';

// This is the formatter for the stack marker spec https://github.com/WICG/js-self-profiling/blob/main/markers.md
export function stackMarkerToHumanReadable(marker: JSSelfProfiling.Marker): string {
  switch (marker) {
    case 'gc':
      return t('Garbage Collection');
    case 'style':
      return t('Style');
    case 'layout':
      return t('Layout');
    case 'paint':
      return t('Paint');
    case 'script':
      return t('Script');
    case 'other':
      return t('Other');
    default:
      // since spec is still in dev, just gracefully return whatever we received.
      return marker;
  }
}
