import {Fragment} from 'react';
import styled from '@emotion/styled';

import Confirm from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TimeSince from 'sentry/components/timeSince';
import {IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import useUserFromId from 'sentry/utils/useUserFromId';
import type {Secret} from 'sentry/views/settings/featureFlags/changeTracking';

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

      <Flex align="center" gap="xs">
        <TimeSince date={secret.createdAt} />
      </Flex>

      <Flex align="center">{isUserPending ? <LoadingIndicator mini /> : user?.name}</Flex>

      <Flex justify="end">
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
              icon={isRemoving ? <LoadingIndicator mini /> : <IconSubtract size="xs" />}
            >
              {t('Remove')}
            </Button>
          </Confirm>
        </Tooltip>
      </Flex>
    </Fragment>
  );
}

const SecretPreview = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
`;
