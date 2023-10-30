import type {ApiApplication as ApiApplicationType} from 'sentry/types';

export function ApiApplication(
  params: Partial<ApiApplicationType> = {}
): ApiApplicationType {
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
