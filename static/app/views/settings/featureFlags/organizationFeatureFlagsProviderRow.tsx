import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import {Flex} from 'sentry/components/container/flex';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Secret} from 'sentry/views/settings/featureFlags';
import useUserFromId from 'sentry/views/settings/featureFlags/useUserFromId';

export function OrganizationFeatureFlagsProviderRow({
  isRemoving,
  secret,
  removeSecret,
}: {
  isRemoving: boolean;
  secret: Secret;
  removeSecret?: (id: number) => void;
}) {
  const {isPending: isUserPending, data: user} = useUserFromId({id: secret.createdBy});

  return (
    <Fragment>
      <div>
        <div>{secret.provider}</div>
        <SecretPreview aria-label={t('Secret preview')}>{secret.secret}</SecretPreview>
      </div>

      <DateTime>
        <TimeSince date={secret.createdAt} />
      </DateTime>

      <Flex align="center">{isUserPending ? <LoadingIndicator mini /> : user?.name}</Flex>

      <Actions>
        <Tooltip
          title={t(
            'You must be an organization owner, manager or admin to remove a secret.'
          )}
          disabled={!!removeSecret}
        >
          <Confirm
            disabled={!removeSecret || isRemoving}
            onConfirm={removeSecret ? () => removeSecret(secret.id) : undefined}
            message={t(
              'Are you sure you want to remove the secret for %s provider? It will not be usable anymore, and this cannot be undone.',
              secret.provider
            )}
          >
            <Button
              size="sm"
              disabled={isRemoving || !removeSecret}
              aria-label={t('Remove secret for %s provider', secret.provider)}
              icon={
                isRemoving ? (
                  <LoadingIndicator mini />
                ) : (
                  <IconSubtract isCircled size="xs" />
                )
              }
            >
              {t('Remove')}
            </Button>
          </Confirm>
        </Tooltip>
      </Actions>
    </Fragment>
  );
}

const Actions = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

const DateTime = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const SecretPreview = styled('div')`
  color: ${p => p.theme.gray300};
`;
