import React from 'react';

import CommitRow from 'app/components/commitRow';

export default {
  title: 'UI/CommitRow',
  component: CommitRow,
};

export const Default = () => {
  const commit = {
    dateCreated: '2018-11-30T18:46:31Z',
    message:
      '(improve) Add Links to Spike-Protection Email (#2408)\n\n* (improve) Add Links to Spike-Protection Email\r\n\r\nUsers now have access to useful links from the blogs and docs on Spike-protection.\r\n\r\n* fixed wording',
    id: 'f7f395d14b2fe29a4e253bf1d3094d61e6ad4434',
    author: {
      username: 'example@sentry.io',
      lastLogin: '2018-11-30T21:18:09.812Z',
      isSuperuser: true,
      isManaged: false,
      lastActive: '2018-11-30T21:25:15.222Z',
      id: '224288',
      isActive: true,
      has2fa: false,
      name: 'Foo Bar',
      avatarUrl: 'https://example.com/avatar.png',
      dateJoined: '2018-02-26T23:57:43.766Z',
      emails: [
        {
          is_verified: true,
          id: '231605',
          email: 'example@sentry.io',
        },
      ],
      avatar: {
        avatarUuid: null,
        avatarType: 'letter_avatar',
      },
      hasPasswordAuth: true,
      email: 'example@sentry.io',
    },
    repository: {
      id: '4',
      name: 'example/repo-name',
      provider: 'github',
      url: 'https://github.com/example/repo-name',
      status: 'active',
      externalSlug: 'example/repo-name',
    },
  };
  const nonuserCommit = {
    ...commit,
    dateCreated: '2018-11-30T18:46:31Z',
    author: {
      username: 'example@sentry.io',
      isActive: true,
      has2fa: false,
      name: 'Foo Bar',
      avatarUrl: 'https://example.com/avatar.png',
      dateJoined: '2018-02-26T23:57:43.766Z',
      emails: [
        {
          is_verified: true,
          id: '231605',
          email: 'example@sentry.io',
        },
      ],
      avatar: {
        avatarUuid: null,
        avatarType: 'letter_avatar',
      },
      hasPasswordAuth: true,
      email: 'example@sentry.io',
    },
  };
  return (
    <div>
      <CommitRow commit={commit} />
      <CommitRow commit={nonuserCommit} />
    </div>
  );
};

Default.storyName = 'CommitRow';
