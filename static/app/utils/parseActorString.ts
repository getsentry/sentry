import type {Actor} from 'sentry/types/core';

export function parseActorString(value: string | undefined): Actor | undefined {
  if (!value) {
    return undefined;
  }
  const [type, id] = value.split(':');
  if (!id || (type !== 'user' && type !== 'team')) {
    return undefined;
  }
  return {type, id, name: ''};
}
