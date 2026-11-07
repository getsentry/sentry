export interface OAuthApplication {
  clientId: string;
  homepageUrl: string | null;
  name: string;
  privacyUrl: string | null;
  requiresOrgLevelAccess: boolean;
  termsUrl: string | null;
}

export interface OAuthContext {
  application: OAuthApplication;
  permissionGroups: Array<{
    actions: string[];
    description: string | null;
    label: string;
    resource: string;
    scopes: string[];
    accessDescriptions?: Record<string, string>;
  }>;
  permissions: string[];
  scopes: string[];
  stage: 'context';
}

export interface OAuthRedirect {
  redirectUrl: string;
  stage: 'redirect';
}

export interface OAuthOrganization {
  id: string;
  name: string;
  slug: string;
}

export interface AuthorizationConsent {
  hasExistingConsent: boolean;
  organizationOptions: OAuthOrganization[];
  stage: 'consent';
  transactionId: string;
}

export interface DeviceConsent {
  organizationOptions: OAuthOrganization[];
  stage: 'consent';
  userCode: string;
}

export type DeviceContext = (OAuthContext & {userCode: string}) | {stage: 'codeEntry'};
export type OAuthDecision = 'approve' | 'deny';
export type AuthorizationParameters = Record<string, string>;

export interface ConsentDecision {
  op: OAuthDecision;
  selectedOrganizationId?: string;
}

export interface DeviceCompletion {
  stage: 'approved' | 'denied';
}
