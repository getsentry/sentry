import {isNativePlatform} from 'app/utils/platform';
import {Event, Group} from 'app/types';

/**
 * Extract the display message from an event.
 */
export function getMessage(event: Event | Group): string | undefined {
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
export function getLocation(event: Event | Group): string | null {
  if (event.type === 'error' && isNativePlatform(event.platform)) {
    return event.metadata.filename || null;
  }
  return null;
}

type EventTitle = {
  title: string;
  subtitle: string;
};

export function getTitle(event: Event | Group): EventTitle {
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
    // Due to a regression some reports did not have message persisted
    // (https://github.com/getsentry/sentry/pull/19794) so we need to fall
    // back to the computed title for these.
    result.title = metadata.message || result.title || '';
    result.subtitle = metadata.origin || '';
  }

  if (metadata.title) {
    result.title = metadata.title;
  }

  return result;
}

/**
 * Returns a short eventId with only 8 characters
 */
export function getShortEventId(eventId: string) {
  return eventId.substring(0, 8);
}
