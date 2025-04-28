import type {User} from 'sentry/types/user';

export const getUsername = ({isManaged, username, email}: User) => {
  const uuidPattern = /[0-9a-f]{32}$/;
  // Users created via SAML receive unique UUID usernames. Use
  // their email in these cases, instead.
  if (username && uuidPattern.test(username)) {
    return email;
  }
  return !isManaged && username ? username : email;
};
