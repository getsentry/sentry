import type {UserEmail} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export const emailsOptions = apiOptions.as<UserEmail[]>()('/users/$userId/emails/', {
  path: {userId: 'me'},
  staleTime: 0,
});
