export type InviteDetails = {
  existingMember: boolean;
  hasAuthProvider: boolean;
  needs2fa: boolean;
  needsAuthentication: boolean;
  orgSlug: string;
  requireSso: boolean;
  inviteEmail?: string | null;
  ssoProvider?: string;
};
