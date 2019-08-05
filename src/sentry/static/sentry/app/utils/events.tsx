import {isNativePlatform} from 'app/utils/platform';
import {Event} from 'app/types';

/**
 * Extract the display message from an event.
 */
export function getMessage(event: Event): string | undefined {
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
export function getLocation(event: Event): string | null {
  if (event.type === 'error' && isNativePlatform(event.platform)) {
    return event.metadata.filename || null;
  }
  return null;
}

type EventTitle = {
  title: string;
  subtitle: string;
};

export function getTitle(event: Event): EventTitle {
  const {metadata, type, culprit} = event;
  const result: EventTitle = {
    title: event.title,
    subtitle: '',
  };

  if (type === 'error') {
    result.subtitle = culprit;
    if (metadata.type) {
      result.title = metadata.type;
    } else {
      result.title = metadata.function || '<unknown>';
    }
  } else if (type === 'csp') {
    result.title = metadata.directive || '';
    result.subtitle = metadata.uri || '';
  } else if (type === 'expectct' || type === 'expectstaple' || type === 'hpkp') {
    result.title = metadata.message || '';
    result.subtitle = metadata.origin || '';
  } else if (type === 'default') {
    result.title = metadata.title || '';
  }

  return result;
}
