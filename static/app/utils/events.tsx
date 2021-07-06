import {
  BaseGroup,
  EventMetadata,
  EventOrGroupType,
  GroupTombstone,
  Organization,
} from 'app/types';
import {Event} from 'app/types/event';
import {isNativePlatform} from 'app/utils/platform';

function isTombstone(maybe: BaseGroup | Event | GroupTombstone): maybe is GroupTombstone {
  return !maybe.hasOwnProperty('type');
}

/**
 * Extract the display message from an event.
 */
export function getMessage(
  event: Event | BaseGroup | GroupTombstone
): string | undefined {
  if (isTombstone(event)) {
    return event.culprit || '';
  }

  const {metadata, type, culprit} = event;

  switch (type) {
    case EventOrGroupType.ERROR:
      return metadata.value;
    case EventOrGroupType.CSP:
      return metadata.message;
    case EventOrGroupType.EXPECTCT:
    case EventOrGroupType.EXPECTSTAPLE:
    case EventOrGroupType.HPKP:
      return '';
    default:
      return culprit || '';
  }
}

/**
 * Get the location from an event.
 */
export function getLocation(event: Event | BaseGroup | GroupTombstone) {
  if (isTombstone(event)) {
    return undefined;
  }

  if (event.type === EventOrGroupType.ERROR && isNativePlatform(event.platform)) {
    return event.metadata.filename || undefined;
  }

  return undefined;
}

function computeTitleWithTreeLabel(metadata: EventMetadata) {
  const {type: title, current_tree_label, finest_tree_label} = metadata;
  const treeLabel = current_tree_label || finest_tree_label;
  const formattedTreeLabel = treeLabel ? treeLabel.join(' | ') : undefined;

  if (!title) {
    return formattedTreeLabel || metadata.function || '<unknown>';
  }

  if (!formattedTreeLabel) {
    return title;
  }

  return `${title} | ${formattedTreeLabel}`;
}

export function getTitle(event: Event | BaseGroup, organization?: Organization) {
  const {metadata, type, culprit} = event;

  const customEventTitle =
    organization?.features.includes('custom-event-title') && metadata?.title
      ? metadata.title
      : undefined;

  switch (type) {
    case EventOrGroupType.ERROR:
      return {
        title: customEventTitle ?? computeTitleWithTreeLabel(metadata),
        subtitle: culprit,
      };
    case EventOrGroupType.CSP:
      return {
        title: customEventTitle ?? metadata.directive ?? '',
        subtitle: metadata.uri ?? '',
      };
    case EventOrGroupType.EXPECTCT:
    case EventOrGroupType.EXPECTSTAPLE:
    case EventOrGroupType.HPKP:
      // Due to a regression some reports did not have message persisted
      // (https://github.com/getsentry/sentry/pull/19794) so we need to fall
      // back to the computed title for these.
      return {
        title: customEventTitle ?? (metadata.message || event.title),
        subtitle: metadata.origin ?? '',
      };
    case EventOrGroupType.DEFAULT:
      return {
        title: customEventTitle ?? metadata.title ?? '',
        subtitle: '',
      };
    default:
      return {
        title: customEventTitle ?? '',
        subtitle: '',
      };
  }
}

/**
 * Returns a short eventId with only 8 characters
 */
export function getShortEventId(eventId: string) {
  return eventId.substring(0, 8);
}
