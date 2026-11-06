import type {InternalAppApiToken} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export const apiTokensOptions = apiOptions.as<InternalAppApiToken[]>()('/api-tokens/', {
  staleTime: 0,
});
