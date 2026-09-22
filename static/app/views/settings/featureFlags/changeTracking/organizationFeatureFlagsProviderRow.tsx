import {Button} from '@sentry/scraps/button';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Confirm} from 'sentry/components/confirm';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useUserFromId} from 'sentry/utils/useUserFromId';
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
    <SimpleTable.Row>
      <SimpleTable.RowCell>
        <div>{secret.provider}</div>
        <Text variant="secondary" aria-label={t('Secret preview')}>
          {secret.secret}
        </Text>
      </SimpleTable.RowCell>

      <SimpleTable.RowCell gap="xs">
        <TimeSince date={secret.createdAt} />
      </SimpleTable.RowCell>

      <SimpleTable.RowCell>
        {isUserPending ? (
          <LoadingIndicator mini />
        ) : (
          (user?.name ?? t('Deactivated user'))
        )}
      </SimpleTable.RowCell>

      <SimpleTable.RowCell justify="end">
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
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}
