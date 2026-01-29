import type {NotificationTemplateRegistry} from 'sentry/debug/notifications/types';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';

export function useRegistry() {
  return useApiQuery<NotificationTemplateRegistry>(
    [getApiUrl('/internal/notifications/registered-templates/')],
    {staleTime: 30000}
  );
}
