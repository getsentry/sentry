import {getInvitationStep} from './getInvitationStep';
import type {InviteDetails} from './types';

const invite: InviteDetails = {
  existingMember: false,
  hasAuthProvider: false,
  needs2fa: false,
  needsAuthentication: false,
  orgSlug: 'org-slug',
  requireSso: false,
};

describe('getInvitationStep', () => {
  it.each([
    [{existingMember: true, needsAuthentication: true}, 'existing-member'],
    [{needsAuthentication: true, needs2fa: true}, 'authentication'],
    [{needsAuthentication: true, requireSso: true}, 'sign-in-sso'],
    [{needs2fa: true, requireSso: true}, 'required-2fa'],
    [{requireSso: true}, 'authenticate-sso'],
    [{}, 'accept'],
  ] as const)('selects the invitation step for %j', (overrides, expected) => {
    expect(getInvitationStep({...invite, ...overrides})).toBe(expected);
  });
});
