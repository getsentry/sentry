import {useMutation} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation, useQueryClient} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {AddIntegrationButton} from './addIntegrationButton';

interface DirectEnableButtonProps {
  buttonProps: Pick<
    React.ComponentProps<typeof AddIntegrationButton>,
    'size' | 'priority' | 'disabled' | 'style' | 'data-test-id' | 'icon' | 'buttonText'
  >;
  providerSlug: string;
  userHasAccess: boolean;
}

export function DirectEnableButton({
  providerSlug,
  buttonProps,
  userHasAccess,
}: DirectEnableButtonProps) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const {mutate: enable, isPending} = useMutation({
    mutationFn: () =>
      fetchMutation({
        url: `/organizations/${organization.slug}/integrations/direct-enable/${providerSlug}/`,
        method: 'POST',
        data: {},
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          getApiUrl(`/organizations/$organizationIdOrSlug/integrations/`, {
            path: {organizationIdOrSlug: organization.slug},
          }),
        ],
      });
      queryClient.invalidateQueries({
        queryKey: [
          getApiUrl(`/organizations/$organizationIdOrSlug/config/integrations/`, {
            path: {organizationIdOrSlug: organization.slug},
          }),
        ],
      });
    },
    onError: () => addErrorMessage(t('Failed to enable integration.')),
  });

  return (
    <Tooltip
      title={t('You do not have permission to enable this integration.')}
      disabled={userHasAccess}
    >
      <Button
        {...buttonProps}
        disabled={buttonProps.disabled || !userHasAccess || isPending}
        busy={isPending}
        onClick={() => enable()}
      >
        {t('Enable Integration')}
      </Button>
    </Tooltip>
  );
}
