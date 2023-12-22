import type {Actor as ActorType} from 'sentry/types';

export function Actor(params: Partial<ActorType> = {}): ActorType {
  return {
    id: '1',
    email: 'foo@example.com',
    name: 'Foo Bar',
    type: 'user',
    ...params,
  };
}
