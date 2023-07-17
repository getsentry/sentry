import {EventOrGroupType, GroupTombstone} from 'sentry/types';

export function Tombstones(params = []): GroupTombstone[] {
  return [
    {
      culprit: 'poll(../../sentry/scripts/views.js)',
      level: 'error',
      actor: {
        username: 'billy@sentry.io',
        id: '1',
        name: 'billy vong',
        avatarUrl:
          'https://secure.gravatar.com/avatar/7b544e8eb9d08ed777be5aa82121155a?s=32&d=mm',
        avatar: {
          avatarUuid: '483ed7478a2248d59211f538c2997e0b',
          avatarType: 'letter_avatar',
        },
        email: 'billy@sentry.io',
        ip_address: '0.0.0.0',
      },
      type: EventOrGroupType.ERROR,
      id: '1',
      metadata: {
        type: 'TypeError',
        value: "Object [object Object] has no method 'updateFrom'",
      },
    },
    ...params,
  ];
}
