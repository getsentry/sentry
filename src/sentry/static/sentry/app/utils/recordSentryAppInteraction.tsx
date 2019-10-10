import {Client} from 'app/api';
import {SentryApp} from 'app/types';

type TSDBField = 'sentry_app_viewed' | 'sentry_app_component_interacted';

export const recordInteraction = async (
  sentryApp: SentryApp,
  field: TSDBField,
  data?: object
): Promise<void> => {
  const api = new Client();
  const endpoint = `/sentry-apps/${sentryApp.slug}/interaction/`;

  return await api.requestPromise(endpoint, {
    method: 'POST',
    data: {
      tsdbField: field,
      ...data,
    },
  });
};
