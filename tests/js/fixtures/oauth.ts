import type {OAuthContext} from 'sentry/views/authV2/oauth/types';

export function OAuthContextFixture(overrides: Partial<OAuthContext> = {}): OAuthContext {
  return {
    stage: 'context',
    application: {
      clientId: 'example-client',
      name: 'Example Application',
      homepageUrl: 'https://example.com',
      privacyUrl: null,
      termsUrl: null,
      requiresOrgLevelAccess: false,
    },
    permissions: ['Read projects'],
    permissionGroups: [
      {
        resource: 'projects',
        label: 'Projects',
        scopes: ['project:read'],
        actions: ['read'],
        description: null,
      },
    ],
    scopes: ['project:read'],
    ...overrides,
  };
}
