import type {ApiApplication} from 'sentry/types/user';

export function ApiApplicationFixture(
  params: Partial<ApiApplication> = {}
): ApiApplication {
  return {
    allowedOrigins: [],
    clientID: 'aowekr12903i9i423094i23904j',
    clientSecret: null,
    homepageUrl: null,
    id: '123',
    name: 'Adjusted Shrimp',
    privacyUrl: null,
    redirectUris: [],
    termsUrl: null,
    ...params,
  };
}
