import type {Authenticator} from 'sentry/types/auth';

import {WebAuthnAssert, type WebAuthnAssertProps} from './webAuthnAssert';

interface Props {
  authenticators: Authenticator[];
  mode: WebAuthnAssertProps['mode'];
  onWebAuthn: WebAuthnAssertProps['onWebAuthn'];
}

export function WebAuthn({authenticators, ...props}: Props) {
  if (!authenticators.length) {
    return null;
  }

  // XXX(epurkhiser): On the backend we are still calling this interface 'u2f',
  // even tohugh it's actually been updated to completely support webAuthn.
  return authenticators
    .filter(auth => auth.id === 'u2f')
    .map(auth => (
      <WebAuthnAssert key={auth.id} {...props} challengeData={auth.challenge} />
    ));
}
