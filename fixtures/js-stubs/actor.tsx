import type {Actor} from 'sentry/types';

export function ActorFixture(params: Partial<Actor> = {}): Actor {
  return {
    id: '1',
    email: 'foo@example.com',
    name: 'Foo Bar',
    type: 'user',
    ...params,
  };
}
