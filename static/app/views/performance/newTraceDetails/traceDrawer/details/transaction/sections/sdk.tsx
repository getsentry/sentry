import type {EventTransaction} from 'sentry/types/event';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';

export function hasSDKContext(event: EventTransaction) {
  return !!event.sdk && !isEmptyObject(event.sdk);
}
