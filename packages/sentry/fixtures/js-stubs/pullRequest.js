import {Repository} from './repository';

export function PullRequest(params = {}) {
  return {
    id: '3',
    author: {
      username: 'jill@example.org',
      lastLogin: '2018-11-01T20:09:19.483Z',
      isSuperuser: false,
    },
    dateCreated: '2018-11-05T15:53:24Z',
    message: 'Closes ISSUE-1',
    repository: Repository(),
    title: 'Fix first issue',
    externalUrl: 'https://example.github.com/example/repo-name/pulls/3',
    ...params,
  };
}
