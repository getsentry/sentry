import {useQuery} from '@tanstack/react-query';

import type {NotificationTemplateRegistry} from 'sentry/debug/notifications/types';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export function useRegistry() {
  return useQuery(
    apiOptions.as<NotificationTemplateRegistry>()(
      '/internal/notifications/registered-templates/',
      {staleTime: 30000}
    )
  );
}
