import {decodeScalar} from 'sentry/utils/queryString';

type Mailbox = 'unresolved' | 'resolved';

export default function decodeMailbox(
  value: string | string[] | undefined | null
): Mailbox {
  switch (decodeScalar(value)) {
    case 'resolved':
      return 'resolved';
    case 'archived':
      return 'resolved';
    default:
      return 'unresolved';
  }
}
