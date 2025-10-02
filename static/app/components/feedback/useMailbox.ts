import {createParser, useQueryState} from 'nuqs';

export type Mailbox = 'unresolved' | 'resolved' | 'ignored';

const parseAsMailbox = createParser<Mailbox>({
  parse: value => {
    switch (value) {
      case 'resolved':
        return 'resolved';
      case 'archived':
      case 'ignored':
      case 'spam':
        return 'ignored';
      default:
        return null;
    }
  },
  serialize: value => value.toString(),
}).withDefault('unresolved');

export const useMailbox = () => useQueryState('mailbox', parseAsMailbox);
