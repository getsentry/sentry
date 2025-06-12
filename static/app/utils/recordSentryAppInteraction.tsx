import {Client} from 'sentry/api';

type TSDBField = 'sentry_app_viewed' | 'sentry_app_component_interacted';

export const recordInteraction = async (
  sentryAppSlug: string,
  field: TSDBField,
  data?: Record<PropertyKey, unknown>
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
