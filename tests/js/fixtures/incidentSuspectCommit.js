import {Repository} from './repository';
import {User} from './user';

export function IncidentSuspectCommit(params = []) {
  return {
    data: {
      repository: Repository(),
      author: User(),
      dateCreated: '2019-03-28T01:36:35.457Z',
      score: 2,
      message:
        'feat: Do something to raven/base.py\nvenenatis curae tincidunt feugiat duis parturient metus',
      id: 'ec85fa0c622c13a09cd27443132711551f45f504',
      ...params,
    },
    type: 'commit',
  };
}
