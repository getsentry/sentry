import {Fragment} from 'react';

import {Flex} from 'sentry/components/container/flex';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TimeSince from 'sentry/components/timeSince';
import useUserFromId from 'sentry/utils/useUserFromId';

import type {TempestCredentials} from './types';

export function CredentialRow({credential}: {credential: TempestCredentials}) {
  const {isPending, data: user} = useUserFromId({id: credential.createdById});
  return (
    <Fragment>
      <Flex align="center">{credential.clientId}</Flex>

      <Flex align="center">{credential.clientSecret}</Flex>

      <Flex align="center">
        <TimeSince date={credential.createdAt} />
      </Flex>

      <Flex align="center">{isPending ? <LoadingIndicator mini /> : user?.email}</Flex>
    </Fragment>
  );
}
