import {useMutation, useQueryClient} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {AddIntegrationButton} from './addIntegrationButton';

interface DirectEnableButtonProps {
  buttonProps: Pick<
    React.ComponentProps<typeof AddIntegrationButton>,
    'size' | 'variant' | 'disabled' | 'style' | 'data-test-id' | 'icon' | 'buttonText'
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
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/integrations/direct-enable/$providerKey/',
          {path: {organizationIdOrSlug: organization.slug, providerKey: providerSlug}}
        ),
        method: 'POST',
        data: {},
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          getApiUrl('/organizations/$organizationIdOrSlug/integrations/', {
            path: {organizationIdOrSlug: organization.slug},
          }),
        ],
      });
      queryClient.invalidateQueries({
        queryKey: [
          getApiUrl('/organizations/$organizationIdOrSlug/config/integrations/', {
            path: {organizationIdOrSlug: organization.slug},
          }),
        ],
      });
    },
    onError: () => addErrorMessage(t('Failed to enable integration.')),
  });

  return (
    // aria-disabled rather than disabled when the user lacks access, so the
    // button stays focusable and the permission tooltip opens on keyboard focus.
    <Button
      {...buttonProps}
      disabled={buttonProps.disabled || isPending}
      aria-disabled={buttonProps.disabled || !userHasAccess || isPending}
      tooltipProps={
        userHasAccess
          ? undefined
          : {title: t('You do not have permission to enable this integration.')}
      }
      busy={isPending}
      onClick={() => {
        if (!userHasAccess) {
          return;
        }
        enable();
      }}
    >
      {t('Enable Integration')}
    </Button>
  );
}
