export enum ErrorCodes {
  invalidPassword = 'Incorrect password',
  invalidSSOSession = 'Your SSO Session has expired, please reauthenticate',
  invalidAccessCategory = 'Please fill out the access category and reason correctly',
  noAuthenticator = 'Please add a U2F authenticator to your account',
  unknownError = 'An error ocurred, please try again',
}
