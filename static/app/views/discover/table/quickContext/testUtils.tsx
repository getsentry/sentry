import {Commit, Repository, User} from 'sentry/types';
import {EventData} from 'sentry/utils/discover/eventView';

export const defaultRow: EventData = {
  id: '6b43e285de834ec5b5fe30d62d549b20',
  issue: 'SENTRY-VVY',
  release: 'backend@22.10.0+aaf33944f93dc8fa4234ca046a8d88fb1dccfb76',
  title: 'error: Error -3 while decompressing data: invalid stored block lengths',
  'issue.id': 3512441874,
  'project.name': 'sentry',
};

export const mockedCommit: Commit = {
  dateCreated: '2020-11-30T18:46:31Z',
  id: 'f7f395d14b2fe29a4e253bf1d3094d61e6ad4434',
  message: 'ref(commitRow): refactor to fc\n',
  author: {
    id: '0',
    username: 'author',
    ip_address: '192.168.1.1',
    email: 'author@commit.com',
    name: 'Author',
  } as User,
  repository: {
    id: '1',
    integrationId: '2',
    name: 'getsentry/sentry',
    dateCreated: '2019-11-30T18:46:31Z',
  } as Repository,
  releases: [],
};

export const mockedUser1 = {
  id: '2',
  username: 'author456',
  ip_address: '192.168.1.1',
  email: 'author1@commit.com',
  name: 'Key Name',
} as User;

export const mockedUser2 = {
  id: '3',
  username: 'author123',
  ip_address: '192.168.1.3',
  email: 'author2@commit.com',
  name: 'Value Name',
} as User;
