import {decodeScalar} from 'sentry/utils/queryString';

type Mailbox = 'unresolved' | 'resolved' | 'ignored';

export default function decodeMailbox(
  value: string | string[] | undefined | null
): Mailbox {
  switch (decodeScalar(value)) {
    case 'resolved':
      return 'resolved';
    case 'archived':
    case 'ignored':
    case 'spam':
      return 'ignored';
    default:
      return 'unresolved';
  }
}
