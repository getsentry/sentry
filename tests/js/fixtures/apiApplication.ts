import type {ApiApplication} from 'sentry/types/user';

export function ApiApplicationFixture(
  params: Partial<ApiApplication> = {}
): ApiApplication {
  return {
    allowedOrigins: [],
    clientID: 'aowekr12903i9i423094i23904j',
    clientSecret: null,
    dateCreated: '2024-01-15T12:00:00.000Z',
    homepageUrl: null,
    id: '123',
    isPublic: false,
    name: 'Adjusted Shrimp',
    privacyUrl: null,
    redirectUris: [],
    termsUrl: null,
    ...params,
  };
}
