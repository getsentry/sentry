import {decodeScalar} from 'sentry/utils/queryString';

export default function decodeFeedbackId(val: string | string[] | null | undefined) {
  const [, feedbackId] = decodeScalar(val, '').split(':');

  // TypeScript thinks `feedbackId` is a string, but it could be undefined.
  // See `noUncheckedIndexedAccess`
  return feedbackId ?? '';
}
