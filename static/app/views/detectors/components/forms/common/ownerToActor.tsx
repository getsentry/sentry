import type {Actor} from 'sentry/types/core';

/**
 * Converts an owner string (e.g. "user:123" or "team:456") to an Actor object.
 */
export function ownerToActor(owner: string | undefined): Actor | undefined {
  if (!owner) {
    return undefined;
  }
  const [type, id] = owner.split(':');
  if (!id || (type !== 'team' && type !== 'user')) {
    return undefined;
  }
  return {type, id, name: ''};
}
