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
    [{existingMember: true, needsAuthentication: true}, true, 'refreshing'],
    [{existingMember: true, needsAuthentication: true}, false, 'existing-member'],
    [{needsAuthentication: true, needs2fa: true}, false, 'authentication'],
    [{needsAuthentication: true, requireSso: true}, false, 'sign-in-sso'],
    [{needs2fa: true, requireSso: true}, false, 'required-2fa'],
    [{requireSso: true}, false, 'authenticate-sso'],
    [{}, false, 'accept'],
  ] as const)(
    'selects the invitation step for %j (refreshing: %s)',
    (overrides, refreshing, expected) => {
      expect(getInvitationStep({...invite, ...overrides}, refreshing)).toBe(expected);
    }
  );
});
