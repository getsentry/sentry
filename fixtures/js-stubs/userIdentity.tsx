import {Identity} from 'sentry/views/settings/account/notifications/types';

export function UserIdentity(): Identity {
  return {
    id: '52',
    identityProvider: {
      id: '4',
      type: 'slack',
      externalId: 'TA99AB9CD',
    },
    externalId: 'UA1J9RTE1',
    status: 'active',
  };
}
