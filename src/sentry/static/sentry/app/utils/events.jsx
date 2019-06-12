import {isNativePlatform} from 'app/utils/platform';

/**
 * Extract the display message from an event.
 */
export function getMessage(event) {
  const {metadata, type, culprit} = event;

  switch (type) {
    case 'error':
      return metadata.value;
    case 'csp':
      return metadata.message;
    case 'expectct':
    case 'expectstaple':
    case 'hpkp':
      return '';
    default:
      return culprit || '';
  }
}

/**
 * Get the location from an event.
 */
export function getLocation(event) {
  if (event.type === 'error' && isNativePlatform(event.platform)) {
    const {metadata} = event || {};
    return metadata.filename || null;
  }
  return null;
}

export function getTitle(event) {
  const {metadata, type, culprit} = event;
  let {title} = event;
  let subtitle = null;

  if (type === 'error') {
    subtitle = culprit;
    if (metadata.type) {
      title = metadata.type;
    } else {
      title = metadata.function || '<unknown>';
    }
  } else if (type === 'csp') {
    title = metadata.directive;
    subtitle = metadata.uri;
  } else if (type === 'expectct' || type === 'expectstaple' || type === 'hpkp') {
    title = metadata.message;
    subtitle = metadata.origin;
  } else if (type === 'default') {
    title = metadata.title;
  }

  return {title, subtitle};
}
