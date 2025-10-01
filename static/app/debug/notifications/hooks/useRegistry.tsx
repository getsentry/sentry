import type {NotificationTemplateRegistry} from 'sentry/debug/notifications/types';
import {useApiQuery} from 'sentry/utils/queryClient';

export function useRegistry() {
  return useApiQuery<NotificationTemplateRegistry>(
    ['/internal/notifications/registered-templates/'],
    {staleTime: 30000}
  );
}
