import {Fragment} from 'react';

import {Flex} from 'sentry/components/container/flex';
import TimeSince from 'sentry/components/timeSince';

import type {TempestCredentials} from './types';

export function CredentialRow({credential}: {credential: TempestCredentials}) {
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
    </Fragment>
  );
}
