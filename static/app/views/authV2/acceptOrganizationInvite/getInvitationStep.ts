import type {InviteDetails} from './types';

export function getInvitationStep(details: InviteDetails) {
  if (details.existingMember) {
    return 'existing-member';
  }

  if (details.needsAuthentication) {
    return details.requireSso ? 'sign-in-sso' : 'authentication';
  }

  if (details.needs2fa) {
    return 'required-2fa';
  }

  return details.requireSso ? 'authenticate-sso' : 'accept';
}

export type InvitationStep = ReturnType<typeof getInvitationStep>;
