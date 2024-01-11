import type {
  Avatar,
  Group,
  Organization,
  Project,
  Team,
  User,
  UserEmail,
} from 'sentry/types';
/**
 * @deprecated
 */
function isAvatarShape(avatar: unknown): null | Error {
  if (typeof avatar !== 'object' || avatar === null) {
    return new Error('avatar is not an object');
  }

  if (!('avatarType' in avatar) || typeof avatar.avatarType !== 'string') {
    return new Error(`avatarType must be string.`);
  }

  const maybeAvatarShape = avatar as Partial<Avatar>;
  if (
    maybeAvatarShape.avatarType !== 'letter_avatar' &&
    maybeAvatarShape.avatarType !== 'upload' &&
    maybeAvatarShape.avatarType !== 'gravatar'
  ) {
    return new Error(`avatarType must be one of 'letter_avatar', 'upload', 'gravatar'.`);
  }

  if (!('avatarUuid' in avatar) || typeof maybeAvatarShape.avatarUuid !== 'string') {
    return new Error(`avatarUuid must be string`);
  }

  return null;
}

/**
 * @deprecated
 */
function isEmailShape(email: unknown): null | Error {
  if (typeof email !== 'object' || email === null) {
    return new Error('email is not of object type');
  }

  const maybeEmailShape = email as Partial<UserEmail>;

  if ('email' in maybeEmailShape && typeof maybeEmailShape.email !== 'string') {
    return new Error(`email must be string.`);
  }

  if ('id' in maybeEmailShape && typeof maybeEmailShape.id !== 'string') {
    return new Error(`id must be string.`);
  }

  if (
    'is_verified' in maybeEmailShape &&
    typeof maybeEmailShape.is_verified !== 'boolean'
  ) {
    return new Error(`is_verified must be boolean.`);
  }

  return null;
}

/**
 * @deprecated
 */
const USER_STRING_KEYS: (keyof User)[] = [
  'avatarUrl',
  'dateJoined',
  'email',
  'id',
  'lastActive',
  'lastLogin',
  'username',
];
const USER_BOOLEAN_KEYS: (keyof User)[] = [
  'has2fa',
  'hasPasswordAuth',
  'isActive',
  'isManaged',
];
function isUserShape(user: unknown): null | Error {
  if (user === null) {
    return null;
  }
  if (typeof user !== 'object') {
    return new Error('user is not of object type');
  }

  const maybeUserShape = user as Partial<User>;

  if ('avatar' in maybeUserShape && isAvatarShape(maybeUserShape.avatar) !== null) {
    return new Error('user.avatar is not of type Avatar');
  }

  if (
    'emails' in maybeUserShape &&
    Array.isArray(maybeUserShape.emails) &&
    !maybeUserShape.emails.every(e => isEmailShape(e) === null)
  ) {
    return null;
  }

  for (const key of USER_BOOLEAN_KEYS) {
    if (key in maybeUserShape && typeof maybeUserShape[key] !== 'boolean') {
      return new Error(`user.${key} is not of type string`);
    }
  }

  if ('identities' in maybeUserShape && !Array.isArray(maybeUserShape.identities)) {
    return new Error('user.id identities not of type array');
  }

  for (const key of USER_STRING_KEYS) {
    if (key in user && typeof user[key] !== 'string') {
      return new Error(`user.${key} is not of type string`);
    }
  }

  return null;
}

/**
 * @deprecated
 */
function isPartialProjectShape(project: unknown): null | Error {
  if (typeof project !== 'object' || project === null) {
    return new Error('project is not of object type');
  }

  for (const key of ['name', 'slug']) {
    if (key in project && typeof project[key] !== 'string') {
      return new Error(`${key} must be string.`);
    }
  }

  return null;
}

const METADATA_STRING_KEYS = ['value', 'message', 'directive', 'type', 'title', 'uri'];
/**
 * @deprecated
 */
function isMetaDataShape(metaData: unknown): null | Error {
  if (typeof metaData !== 'object' || metaData === null) {
    return new Error('metaData is not of object type');
  }

  for (const key of METADATA_STRING_KEYS) {
    if (key in metaData && typeof metaData[key] !== 'string') {
      return new Error(`value must be string.`);
    }
  }

  return null;
}

/**
 * @deprecated
 */

/**
 * @deprecated
 */
const GROUP_NUMBER_KEYS: (keyof Group)[] = ['userCount', 'numComments'];
const GROUP_BOOLEAN_KEYS: (keyof Group)[] = [
  'hasSeen',
  'isBookmarked',
  'isPublic',
  'isSubscribed',
];
const GROUP_STRING_KEYS: (keyof Group)[] = [
  'lastSeen',
  'count',
  'culprit',
  'firstSeen',
  'level',
  'permalink',
  'shareId',
  'shortId',
  'status',
  'title',
];

/**
 * @deprecated
 */
function isGroup(
  props: unknown,
  propName: string,
  _componentName: unknown
): null | Error {
  if (typeof props !== 'object' || props === null) {
    return new Error('props is not an object');
  }

  if (!(propName in props) || typeof props[propName] !== 'object') {
    return null;
  }

  if (!props[propName]) {
    return null;
  }

  const group = props[propName];

  if (!('id' in group) || typeof group.id !== 'string') {
    return new Error(`id must be string.`);
  }

  for (const key of GROUP_NUMBER_KEYS) {
    if (key in group && typeof group[key] !== 'number') {
      return new Error(`${key} must be number.`);
    }
  }

  for (const key of GROUP_BOOLEAN_KEYS) {
    if (key in group && typeof group[key] !== 'boolean') {
      return new Error(`${key} must be boolean.`);
    }
  }

  if ('logger' in group) {
    if (typeof group.logger !== 'string' && group.logger !== null) {
      return new Error(`logger must be of string or null type.`);
    }
  }

  for (const key of GROUP_STRING_KEYS) {
    if (key in group && typeof group[key] !== 'string') {
      return new Error(`${key} must be string. got ${group[key]}`);
    }
  }

  if ('type' in group) {
    if (typeof group.type !== 'string') {
      return new Error(`type must be string.`);
    }
    if (
      group.type !== 'error' &&
      group.type !== 'csp' &&
      group.type !== 'hpkp' &&
      group.type !== 'expectct' &&
      group.type !== 'expectstaple' &&
      group.type !== 'default' &&
      group.type !== 'transaction'
    ) {
      return new Error(
        `type must be one of 'error', 'csp', 'hpkp', 'expectct', 'expectstaple', 'default', 'transaction'.`
      );
    }
  }

  if ('statusDetails' in group && typeof group.statusDetails !== 'object') {
    return new Error(`statusDetails must be object.`);
  }

  if ('annotations' in group && !Array.isArray(group.annotations)) {
    return new Error(`annotations must be of array type.`);
  }

  if ('assignedTo' in group && isUserShape(group.assignedTo) !== null) {
    return new Error(`assignedTo must be of type User.`);
  }

  if ('metadata' in group && isMetaDataShape(group.metadata) !== null) {
    return new Error(`metadata must be of type MetaData.`);
  }

  if ('project' in group && isPartialProjectShape(group.project) !== null) {
    return new Error(`project must be of type PartialProject.`);
  }

  return null;
}

/**
 * @deprecated
 */
function isTeamShape(team: unknown) {
  if (typeof team !== 'object' || team === null) {
    return new Error('Team has to be of object type');
  }

  const maybeTeamShape = team as Partial<Team>;
  if (!('id' in maybeTeamShape) || typeof maybeTeamShape.id !== 'string') {
    return new Error(`id must be string.`);
  }

  if (!('slug' in maybeTeamShape) || typeof maybeTeamShape.slug !== 'string') {
    return new Error(`slug must be string.`);
  }

  return null;
}

/**
 * @deprecated
 */
function isProject(
  props: unknown,
  propName: string,
  _componentName: unknown
): null | Error {
  if (typeof props !== 'object' || props === null) {
    return new Error('props is not an object');
  }

  if (!(propName in props) || typeof props[propName] !== 'object') {
    return null;
  }

  if (!props[propName]) {
    return null;
  }

  const project = props[propName] as Partial<Project>;

  if (
    !('id' in project) ||
    ('id' in project && typeof project.id !== 'string' && typeof project.id !== 'number')
  ) {
    return new Error(`id must be string or number.`);
  }
  if ('slug' in project && typeof project.slug !== 'string') {
    return new Error('slug must be string');
  }

  if ('isBookmarked' in project && typeof project.isBookmarked !== 'boolean') {
    return new Error('isBookmarked must be boolean');
  }
  if ('status' in project && typeof project.status !== 'string') {
    return new Error('status must be string');
  }

  if ('teams' in project) {
    if (!Array.isArray(project.teams)) {
      return new Error('teams must be array');
    }
    if (!project.teams.every(t => isTeamShape(t) === null)) {
      return new Error(`teams must be array of Team types.`);
    }
  }

  if ('name' in project && typeof project.name !== 'string') {
    return new Error('name must be string');
  }

  return null;
}

/**
 * @deprecated
 */
function isOrganization(
  props: unknown,
  propName: string,
  _componentName: unknown
): null | Error {
  if (typeof props !== 'object' || props === null) {
    return new Error('props does not contain organization property');
  }

  if (!(propName in props)) {
    return null;
  }

  if (!props[propName]) {
    return null;
  }

  const organization = props[propName] as Partial<Organization>;

  if (
    !('id' in organization) ||
    ('id' in organization && typeof organization.id !== 'string')
  ) {
    return new Error(`id must be string.`);
  }

  return null;
}

/**
 * @deprecated
 */
function isObject(
  props: unknown,
  propName: string,
  _componentName: unknown
): null | Error {
  if (typeof props !== 'object' || props === null) {
    return new Error('props does not contain organization property');
  }

  if (!(propName in props)) {
    return null;
  }

  if (!props[propName]) {
    return null;
  }

  if (typeof props[propName] !== 'object') {
    throw new Error(`props.${propName} is not of type object`);
  }

  return null;
}
/**
 * @deprecated
 */
export const SentryPropTypeValidators = {
  isGroup,
  isProject,
  isOrganization,
  isObject,
};
