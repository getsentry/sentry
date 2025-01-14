import {Fragment} from 'react';

import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import {Flex} from 'sentry/components/container/flex';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';

import type {TempestCredentials} from './types';

export function CredentialRow({
  credential,
  isRemoving,
  removeCredential,
}: {
  credential: TempestCredentials;
  isRemoving: boolean;
  removeCredential?: (data: {id: number}) => void;
}) {
  return (
    <Fragment>
      <Flex align="center">{credential.clientId}</Flex>

      <Flex align="center">{credential.clientSecret}</Flex>

      <Flex align="center">
        <TimeSince date={credential.dateAdded} />
      </Flex>

      <Flex align="center">
        {credential.createdByEmail ? credential.createdByEmail : '\u2014'}
      </Flex>

      <Flex align="center" justify="flex-end">
        <Tooltip
          title={t('You must be an organization admin to remove credentials.')}
          disabled={!!removeCredential}
        >
          <Confirm
            message={t('Are you sure you want to remove the credentials?')}
            onConfirm={
              removeCredential ? () => removeCredential({id: credential.id}) : undefined
            }
            disabled={isRemoving || !removeCredential}
          >
            <Button
              size="xs"
              disabled={isRemoving || !removeCredential}
              aria-label={t('Remove credentials')}
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
      </Flex>
    </Fragment>
  );
}
