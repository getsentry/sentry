// TODO(epurkhiser): These can't be translated with `t()` because they're an
// Enum. We should probably just use a regular map
export enum ErrorCodes {
  INVALID_PASSWORD = 'Incorrect password',
  INVALID_SSO_SESSION = 'Your SSO Session has expired, please reauthenticate',
  INVALID_ACCESS_CATEGORY = 'Please fill out the access category and reason correctly',
  NO_AUTHENTICATOR = 'Please add a U2F authenticator to your account',
  UNKNOWN_ERROR = 'An error occurred, please try again',
}
