type ParsedActorIdentifier = {
  id: string;
  type: 'user' | 'team';
};

/**
 * Actor is a backend model that is used for things like assignment or ownership
 * and can describe a user or a team.
 *
 * Examples:
 * 1231 -> User with ID 1231
 * "1231" -> User with ID 1231
 * "user:1231" -> User with ID 1231
 * "team:1231" -> Team with ID 1231
 */
export function parseActorIdentifier(
  actorIdentifier: string | number | null
): ParsedActorIdentifier | null {
  if (!actorIdentifier) {
    return null;
  }

  if (typeof actorIdentifier === 'number') {
    return {type: 'user', id: actorIdentifier.toString()};
  }

  if (actorIdentifier.startsWith('user:')) {
    return {type: 'user', id: actorIdentifier.replace('user:', '')};
  }
  if (actorIdentifier.startsWith('team:')) {
    return {type: 'team', id: actorIdentifier.replace('team:', '')};
  }

  return {type: 'user', id: actorIdentifier};
}
