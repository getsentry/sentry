// TODO(epurkhiser): These can't be translated with `t()` because they're an
// Enum. We should probably just use a regular map
export enum ErrorCodes {
  invalidPassword = 'Incorrect password',
  invalidSSOSession = 'Your SSO Session has expired, please reauthenticate',
  invalidAccessCategory = 'Please fill out the access category and reason correctly',
  noAuthenticator = 'Please add a U2F authenticator to your account',
  unknownError = 'An error ocurred, please try again',
}
