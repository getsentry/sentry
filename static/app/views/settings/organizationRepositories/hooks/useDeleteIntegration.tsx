import {useMutation} from '@tanstack/react-query';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import {apiFetch} from 'sentry/utils/api/apiFetch';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

interface UseDeleteIntegrationOptions {
  onSuccess?: (integration: Integration) => void;
}

export function useDeleteIntegration({onSuccess}: UseDeleteIntegrationOptions = {}) {
  const organization = useOrganization();

  const mutation = useMutation({
    mutationFn: (integration: Integration) =>
      apiFetch({
        queryKey: [
          getApiUrl('/organizations/$organizationIdOrSlug/integrations/$integrationId/', {
            path: {
              organizationIdOrSlug: organization.slug,
              integrationId: integration.id,
            },
          }),
          {method: 'DELETE'},
        ],
      }),
    onSuccess: (_data, integration) => {
      addSuccessMessage(t('%s has been removed.', integration.name));
      onSuccess?.(integration);
    },
    onError: () => {
      addErrorMessage(t('Failed to remove integration'));
    },
  });

  return (integration: Integration) => {
    openConfirmModal({
      header: t('Uninstall integration'),
      message: t(
        "Sentry will lose access to linked repositories, external issues, team mappings, and notifications from this integration will stop. Your data in %s isn't affected. You can reinstall anytime.",
        integration.provider.name
      ),
      confirmText: t("I'm sure, uninstall"),
      priority: 'danger',
      onConfirm: () => mutation.mutate(integration),
    });
  };
}
