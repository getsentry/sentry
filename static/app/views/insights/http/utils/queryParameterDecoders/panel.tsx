import {decodeScalar} from 'sentry/utils/queryString';

const DEFAULT_PANEL = 'duration';
type Panel = 'duration' | 'status';

export default function decode(value: string | string[] | undefined | null): Panel {
  switch (decodeScalar(value)) {
    case 'duration':
      return 'duration';
    case 'status':
      return 'status';
    default:
      return DEFAULT_PANEL;
  }
}
