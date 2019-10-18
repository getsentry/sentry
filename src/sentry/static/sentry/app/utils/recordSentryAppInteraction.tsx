import {Client} from 'app/api';

type TSDBField = 'sentry_app_viewed' | 'sentry_app_component_interacted';

export const recordInteraction = async (
  sentryAppSlug: string,
  field: TSDBField,
  data?: object
): Promise<void> => {
  const api = new Client();
  const endpoint = `/sentry-apps/${sentryAppSlug}/interaction/`;

  return await api.requestPromise(endpoint, {
    method: 'POST',
    data: {
      tsdbField: field,
      ...data,
    },
  });
};
